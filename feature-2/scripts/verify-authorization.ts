import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createApp } from '../server/app'
import { databaseClient, disconnectDatabase } from '../server/database'
import { createRegistrationService } from '../server/auth/registration'
import { prismaRegistrationRepository } from '../server/auth/registration-repository'
import { createSessionService } from '../server/auth/sessions'
import { prismaSessionRepository } from '../server/auth/session-repository'
import { createSessionTokens, ACCESS_SECONDS } from '../server/auth/session-tokens'
import { prismaOrganizerReadRepository } from '../server/organizer/read-repository'

const db = databaseClient()
const rollback = new Error('ROLLBACK_AUTHORIZATION_CHECK')
const tag = randomUUID()
const emails: string[] = []
const eventIds: string[] = []
let currentCheck = 'connection'

async function main() {
  await assert.rejects(db.$transaction(async tx => {
    let time = new Date()
    const now = () => new Date(time)
    const service = createSessionService({ repository: prismaSessionRepository(tx, work => work(tx)),
      tokens: createSessionTokens(randomBytes(32).toString('hex')), now })
    const app = createApp({ sessionService: service, now, secureCookies: false,
      registrationService: createRegistrationService({ repository: prismaRegistrationRepository(tx) }),
      organizerRepository: prismaOrganizerReadRepository(tx),
    })
    const server = app.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Missing port')
    const base = 'http://127.0.0.1:' + address.port
    const post = (path: string, body: unknown, cookie = '', csrf = '') => fetch(base + '/api/auth/' + path, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-temuevent-client': 'web',
        origin: 'http://localhost:3001', cookie, 'x-csrf-token': csrf }, body: JSON.stringify(body),
    })
    const get = (path: string, cookie = '', extra: Record<string, string> = {}) =>
      fetch(base + path, { headers: { cookie, ...extra } })
    const cookieHeader = (res: Response) => res.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
    const refreshSecret = (res: Response) => res.headers.getSetCookie()
      .find(value => value.startsWith('temuevent_refresh='))!.split(';')[0].split('=')[1]
    const password = randomBytes(24).toString('base64url')
    try {
      currentCheck = 'register and sign in three isolated accounts'
      const accounts = []
      for (const [label, role] of [['customer', 'CUSTOMER'], ['organizer-a', 'ORGANIZER'], ['organizer-b', 'ORGANIZER']] as const) {
        const email = 'authorization-' + label + '-' + tag + '@example.test'
        emails.push(email)
        const registration = await post('register', { name: 'Authorization ' + label, email, password, role })
        assert.equal(registration.status, 201)
        const user = (await registration.json()).data.user
        const login = await post('login', { email, password })
        assert.equal(login.status, 200)
        accounts.push({ user, cookie: cookieHeader(login), csrf: (await login.json()).data.csrfToken, refresh: refreshSecret(login) })
      }
      const [customer, organizerA, organizerB] = accounts
      currentCheck = 'create transaction-local event and purchase fixtures'
      for (const [index, account] of [organizerA, organizerB].entries()) {
        const event = await tx.event.create({ data: {
          organizerId: account.user.id, slug: 'authorization-' + tag + '-' + index,
          name: 'Authorization Event ' + index, category: 'Learning', location: 'Jakarta',
          startAt: new Date(time.getTime() + 3600000), endAt: new Date(time.getTime() + 7200000), status: 'PUBLISHED',
        } })
        eventIds.push(event.id)
        const price = index === 0 ? 50000n : 0n
        const ticket = await tx.ticketType.create({ data: {
          eventId: event.id, name: 'Regular', price, quota: 10, availableSeats: index === 0 ? 7 : 9,
        } })
        const quantity = index === 0 ? 2 : 1, total = price * BigInt(quantity)
        const purchase = await tx.purchase.create({ data: {
          reference: 'AUTHORIZATION-' + tag + '-' + index, customerId: customer.user.id,
          eventId: event.id, status: 'DONE', subtotal: total, totalPrice: total, completedAt: now(),
        } })
        await tx.purchaseItem.create({ data: {
          eventId: event.id, purchaseId: purchase.id, ticketTypeId: ticket.id,
          quantity, unitPrice: price, lineTotal: total,
        } })
        if (index === 0) {
          const pending = await tx.purchase.create({ data: {
            reference: 'AUTHORIZATION-PENDING-' + tag, customerId: customer.user.id,
            eventId: event.id, status: 'WAITING_FOR_PAYMENT', subtotal: price, totalPrice: price,
            paymentDueAt: new Date(time.getTime() + 7200000),
          } })
          await tx.purchaseItem.create({ data: {
            eventId: event.id, purchaseId: pending.id, ticketTypeId: ticket.id,
            quantity: 1, unitPrice: price, lineTotal: price,
          } })
        }
      }

      currentCheck = 'anonymous, forged and wrong-role access'
      assert.equal((await get('/api/me')).status, 401)
      assert.equal((await get('/api/me', '', { 'x-demo-persona': 'organizer', 'x-user-id': organizerA.user.id })).status, 401)
      const me = await get('/api/me', customer.cookie)
      assert.equal(me.status, 200)
      assert.equal((await me.json()).data.id, customer.user.id)
      assert.equal((await get('/api/organizer/events', customer.cookie, { 'x-role': 'ORGANIZER' })).status, 403)

      currentCheck = 'owned event filtering and cross-organizer record protection'
      for (const [index, account] of [organizerA, organizerB].entries()) {
        const own = await get('/api/organizer/events', account.cookie)
        assert.equal(own.status, 200)
        const body = await own.json()
        assert.equal(body.data.pagination.total, 1)
        assert.deepEqual(body.data.items.map((item: { id: string }) => item.id), [eventIds[index]])
      }
      const other = await get('/api/organizer/events/' + eventIds[1] + '/attendees', organizerA.cookie)
      assert.equal(other.status, 404)
      const missing = await get('/api/organizer/events/' + randomUUID() + '/attendees', organizerA.cookie)
      assert.equal(missing.status, 404)
      assert.deepEqual(await other.json(), await missing.json())
      assert.equal((await get('/api/organizer/events/' + eventIds[0] + '/attendees', customer.cookie)).status, 403)

      currentCheck = 'confirmed attendee quantities and integer IDR projection'
      const attendees = await get('/api/organizer/events/' + eventIds[0] + '/attendees', organizerA.cookie)
      assert.equal(attendees.status, 200)
      const data = (await attendees.json()).data
      assert.equal(data.pagination.total, 1) // Pending purchase is excluded.
      assert.equal(data.items[0].customerId, customer.user.id)
      assert.equal(data.items[0].name, customer.user.name)
      assert.equal(data.items[0].ticketQuantity, 2)
      assert.equal(data.items[0].totalPaid, 100000)
      assert.equal('email' in data.items[0], false)
      const free = await get('/api/organizer/events/' + eventIds[1] + '/attendees', organizerB.cookie)
      assert.equal((await free.json()).data.items[0].totalPaid, 0)
      const nextPage = await get('/api/organizer/events/' + eventIds[0] + '/attendees?page=2&pageSize=1', organizerA.cookie)
      assert.deepEqual((await nextPage.json()).data.items, [])

      currentCheck = 'CSRF credential belongs to the authenticated session'
      const sessionA = await tx.authSession.findFirstOrThrow({ where: { userId: organizerA.user.id } })
      assert.equal(await service.verifySessionCsrf(sessionA.id, organizerA.refresh, organizerA.csrf), true)
      assert.equal(await service.verifySessionCsrf(sessionA.id, organizerB.refresh, organizerB.csrf), false)

      currentCheck = 'role changes take effect without replacing the access JWT'
      await tx.user.update({ where: { id: organizerA.user.id }, data: { role: 'CUSTOMER' } })
      assert.equal((await get('/api/organizer/events', organizerA.cookie)).status, 403)
      await tx.user.update({ where: { id: organizerA.user.id }, data: { role: 'ORGANIZER' } })
      assert.equal((await get('/api/organizer/events', organizerA.cookie)).status, 200)

      currentCheck = 'expired access, renewed access and logout protect the new routes'
      time = new Date(time.getTime() + ACCESS_SECONDS * 1000)
      assert.equal((await get('/api/me', organizerA.cookie)).status, 401)
      const refreshed = await post('refresh', {}, organizerA.cookie, organizerA.csrf)
      assert.equal(refreshed.status, 200)
      const renewedCookie = cookieHeader(refreshed), renewed = await refreshed.json()
      assert.equal((await get('/api/me', renewedCookie)).status, 200)
      assert.equal(await service.verifySessionCsrf(sessionA.id, organizerA.refresh, organizerA.csrf), false)
      assert.equal((await post('logout', {}, renewedCookie, renewed.data.csrfToken)).status, 200)
      assert.equal((await get('/api/me', renewedCookie)).status, 401)
      assert.equal((await get('/api/organizer/events', renewedCookie)).status, 401)
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
    throw rollback
  }, { timeout: 45000 }), error => error === rollback)
  currentCheck = 'rollback cleanup'
  assert.equal(await db.user.count({ where: { email: { in: emails } } }), 0)
  assert.equal(await db.event.count({ where: { id: { in: eventIds } } }), 0)
  console.log(JSON.stringify({ passed: [
    'Real HTTP register/login -> protected identity -> Prisma/Supabase',
    '401 for missing/forged/expired/revoked credentials; 403 for customer on organizer routes',
    'Each organizer reads only owned events; other-owner and missing event both return 404',
    'Attendee projection includes DONE only, quantities, safe integer IDR and free confirmations',
    'Current role changes and refresh-session CSRF binding enforced against database records',
    'All temporary users/events/tickets/purchases/sessions rolled back',
  ], boundary: 'Backend middleware and reads. No frontend form wiring, purchase decisions or attendance/check-in implementation.' }, null, 2))
}

main().catch(() => {
  console.error('Authorization verification failed at: ' + currentCheck)
  process.exitCode = 1
}).finally(disconnectDatabase)
