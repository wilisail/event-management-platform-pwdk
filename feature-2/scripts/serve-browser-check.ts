import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createApp } from '../server/app'
import { databaseClient, disconnectDatabase } from '../server/database'
import { createRegistrationService } from '../server/auth/registration'
import { prismaRegistrationRepository } from '../server/auth/registration-repository'
import { createSessionService } from '../server/auth/sessions'
import { prismaSessionRepository } from '../server/auth/session-repository'
import { createSessionTokens, ACCESS_SECONDS } from '../server/auth/session-tokens'
import { prismaOrganizerReadRepository } from '../server/organizer/read-repository'
import { registrationSavepoints } from './helpers/registration-transaction'

// QA-only runner, bound to loopback. No control endpoints are exposed to the browser.
const origin = process.env.BROWSER_QA_ORIGIN
const email = process.env.BROWSER_QA_ORGANIZER_EMAIL
const password = process.env.BROWSER_QA_PASSWORD
const signingKey = process.env.AUTH_JWT_SECRET
if (process.env.BROWSER_QA_ENABLE !== 'true' || !origin || !email || !password || !signingKey) {
  throw new Error('Explicit browser QA settings are required')
}
const db = databaseClient(), rollback = new Error('ROLLBACK_BROWSER_CHECK')
let stop: () => void = () => {}
let offset = 0
process.once('SIGTERM', () => stop())
process.once('SIGINT', () => stop())
// A server-side test signal advances the test clock; this is not an HTTP/API capability.
process.on('SIGUSR1', () => { offset += (ACCESS_SECONDS + 60) * 1000; console.log('QA access clock advanced') })

async function main() {
  await assert.rejects(db.$transaction(async tx => {
    const now = () => new Date(Date.now() + offset)
    const registration = createRegistrationService({ repository: prismaRegistrationRepository(tx, registrationSavepoints(tx)) })
    const organizer = await registration.register({ name: 'Browser Check Organizer', email, password, role: 'ORGANIZER' })
    const customer = await tx.user.findUniqueOrThrow({ where: { email: 'ayu@example.test' } })
    const event = await tx.event.create({ data: {
      organizerId: organizer.id, slug: 'browser-check-' + randomUUID(), name: 'TemuEvent Browser Check',
      category: 'Learning', location: 'Jakarta', startAt: new Date(Date.now() + 86400000), endAt: new Date(Date.now() + 90000000), status: 'PUBLISHED',
    } })
    const ticket = await tx.ticketType.create({ data: { eventId: event.id, name: 'Regular', price: 50000n, quota: 10, availableSeats: 8 } })
    const purchase = await tx.purchase.create({ data: {
      reference: 'BROWSER-CHECK-' + randomUUID(), customerId: customer.id, eventId: event.id,
      status: 'DONE', subtotal: 100000n, totalPrice: 100000n, completedAt: new Date(),
    } })
    await tx.purchaseItem.create({ data: { eventId: event.id, purchaseId: purchase.id,
      ticketTypeId: ticket.id, quantity: 2, unitPrice: 50000n, lineTotal: 100000n } })
    const sessions = createSessionService({ repository: prismaSessionRepository(tx, work => work(tx)),
      tokens: createSessionTokens(signingKey!), now })
    const server = createApp({ registrationService: registration, sessionService: sessions,
      organizerRepository: prismaOrganizerReadRepository(tx), now, secureCookies: true,
      allowedOrigins: [origin!],
    }).listen(4002, '127.0.0.1', () => console.log('BROWSER_QA_READY: loopback API; all writes roll back on shutdown'))
    try { await new Promise<void>(resolve => { stop = resolve }) }
    finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
    throw rollback
  }, { timeout: 20 * 60 * 1000 }), error => error === rollback)
  assert.equal(await db.user.count({ where: { email } }), 0)
  console.log('BROWSER_QA_ROLLED_BACK')
}
main().catch(() => { console.error('Browser QA transaction ended unexpectedly'); process.exitCode = 1 }).finally(disconnectDatabase)

