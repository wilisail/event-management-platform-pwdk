import assert from 'node:assert/strict'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { readFile, readdir, mkdir, writeFile, rename } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const require = createRequire(import.meta.url)
const { PrismaClient: EventClient } = require('../../generated/prisma/client.ts')
const { PrismaClient: AccountClient } = require('../../feature-2/generated/prisma/client.ts')
const { createApp: createEvents } = require('../../server/app.ts')
const { readEventReviews, readOrganizerProfile, readPublishedEventById } = require('../../server/database.ts')
const { createApp: createAccounts } = require('../../feature-2/server/app.ts')
const { prismaOrganizerReadRepository } = require('../../feature-2/server/organizer/read-repository.ts')
const { prismaEventReviewRepository } = require('../../feature-2/server/organizer/event-reviews.ts')
const { createProfileService } = require('../../feature-2/server/profile/service.ts')
const { prismaProfileRepository } = require('../../feature-2/server/profile/repository.ts')
const { createAuthClient, AuthApiError } = require('../../feature-2/lib/auth-client.ts')
const { sessionFixture, testAccount, loginFields } = require('../../feature-2/tests/helpers/sessions.ts')

const args = process.argv.slice(2)
if (args.length && (args.length !== 2 || args[0] !== '--report' || args[1].startsWith('--'))) {
  throw new Error('Usage: verify-round6-isolated.mjs [--report PATH]')
}
const evidence = { checkedAt: new Date().toISOString(), scope: 'ISOLATED_ROUND6_F2',
  liveDatabaseUsed: false, externalEmailSent: false, ownerStandbyRequired: false,
  ownerBrowserAccepted: false, fullF1JourneyAccepted: false, scenarios: [] }
const passed = name => { evidence.scenarios.push(name); console.log('ROUND6_OK:', name) }
const pg = await PGlite.create()
let socket, pool, eventDb, db, server
try {
  await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;')
  const root = new URL('../prisma/migrations/', import.meta.url)
  const migrations = (await readdir(root, { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name).sort()
  for (const name of migrations) await pg.exec(await readFile(new URL(name + '/migration.sql', root), 'utf8'))
  socket = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 0 }); await socket.start()
  pool = new Pool({ connectionString: `postgresql://postgres@${socket.getServerConn()}/postgres`, max: 1, ssl: false })
  const adapter = () => new PrismaPg(pool, { disposeExternalPool: false })
  eventDb = new EventClient({ adapter: adapter() }); db = new AccountClient({ adapter: adapter() })
  await db.$executeRaw`SET ROLE temuevent_app`
  // Match the application's UTC timestamp transport; reporting still uses explicit Jakarta dates.
  await db.$executeRaw`SET TIME ZONE 'UTC'`
  evidence.postgresSessionTimeZone = 'UTC'
  evidence.migrationsReplayed = migrations.length
  evidence.databaseConcurrency = 'Concurrent HTTP requests share one disposable PostgreSQL connection; live independent-session races remain unverified.'
  const auth = sessionFixture()
  auth.advance(+new Date('2026-11-11T12:00:00Z') - +auth.now())
  const user = async (tag, role = 'CUSTOMER') => {
    const account = { ...testAccount, id: randomUUID(), name: 'Round 6 ' + tag, email: tag + '@example.test',
      role, referralCode: randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase() }
    auth.users.set(account.email, account)
    const { id, name, email, referralCode } = account
    await db.user.create({ data: { id, name, email, role, referralCode } })
    return account
  }
  const owner = await user('organizer', 'ORGANIZER'), foreignOwner = await user('other-organizer', 'ORGANIZER')
  const buyer = await user('attendee'), second = await user('second-attendee'), waitingBuyer = await user('waiting')
  const earlierBuyer = await user('earlier'), outsider = await user('no-purchase')
  const event = async (organizerId, status = 'PUBLISHED') => db.event.create({ data: {
    organizerId, slug: 'round6-' + randomUUID(), name: 'Disposable attendance event', category: 'Learning', location: 'Jakarta',
    status, startAt: new Date('2026-11-09T03:00:00Z'), endAt: new Date('2026-11-09T06:00:00Z'),
    ticketTypes: { create: [{ name: 'Regular', price: 50000n, quota: 100, availableSeats: 90 },
      { name: 'VIP', price: 50000n, quota: 100, availableSeats: 90 }] },
  }, include: { ticketTypes: true } })
  const ownEvent = await event(owner.id), otherEvent = await event(foreignOwner.id), draft = await event(owner.id, 'DRAFT')
  const purchase = async (customer, e, status, amount, completedAt, quantities = [1]) => {
    const row = await db.purchase.create({ data: {
    id: randomUUID(), reference: 'R6-' + randomUUID(), customerId: customer.id, eventId: e.id, status,
    subtotal: BigInt(amount), totalPrice: BigInt(amount),
    completedAt: status === 'DONE' ? new Date(completedAt) : null,
    paymentDueAt: status === 'WAITING_FOR_PAYMENT' ? new Date(+auth.now() + 7200000) : null,
    items: { create: quantities.map((quantity, i) => ({ ticketTypeId: e.ticketTypes[i].id,
      quantity, unitPrice: 50000n, lineTotal: 50000n * BigInt(quantity) })) },
  } })
    // Preserve exact instants even when the disposable PostgreSQL session inherits a non-UTC timezone.
    if (status === 'DONE') await db.$executeRaw`UPDATE temuevent.purchases SET completed_at = ${completedAt}::timestamptz WHERE id = ${row.id}::uuid`
    return db.purchase.findUniqueOrThrow({ where: { id: row.id } })
  }
  const confirmed = await purchase(buyer, ownEvent, 'DONE', 150000, '2026-11-10T17:01:00Z', [2, 1])
  const confirmed2 = await purchase(second, ownEvent, 'DONE', 50000, '2026-11-11T04:00:00Z')
  const priorDay = await purchase(earlierBuyer, ownEvent, 'DONE', 50000, '2026-11-10T16:59:00Z')
  const waiting = await purchase(waitingBuyer, ownEvent, 'WAITING_FOR_PAYMENT', 50000)
  await purchase(waitingBuyer, ownEvent, 'REJECTED', 50000)
  const foreign = await purchase(buyer, otherEvent, 'DONE', 50000, '2026-11-11T04:00:00Z')
  const reviews = prismaEventReviewRepository(db), organizer = prismaOrganizerReadRepository(db)
  const profileService = createProfileService({ repository: prismaProfileRepository(db, work => db.$transaction(work)),
    normalize: async () => { throw new Error('No image normalization in this QA flow') }, readOrganizerRating: reviews.organizerRating })
  const accounts = createAccounts({ sessionService: auth.service, secureCookies: false, now: auth.now,
    fallthrough: true, organizerRepository: organizer, profileService })
  const app = createEvents({ sessionService: auth.service, secureCookies: false, now: auth.now, accountApi: accounts,
    reviewCreator: reviews.create, reviewEligibility: reviews.eligibility,
    eventReader: id => readPublishedEventById(id, eventDb),
    reviewReader: id => readEventReviews(id, eventDb), organizerReader: id => readOrganizerProfile(id, eventDb) })
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  const login = async account => auth.service.login({ ...loginFields, email: account.email })
  const ownerLogin = await login(owner), foreignLogin = await login(foreignOwner), buyerLogin = await login(buyer)
  const secondLogin = await login(second), waitingLogin = await login(waitingBuyer), outsiderLogin = await login(outsider)
  const cookie = actor => `temuevent_access=${actor.accessToken}; temuevent_refresh=${actor.refreshToken}`
  const get = (path, actor) => fetch(base + path, { headers: actor ? { cookie: cookie(actor) } : {} })
  const post = (path, actor, body, headers = {}) => fetch(base + path, { method: 'POST', headers: {
    ...(actor ? { cookie: cookie(actor), 'x-csrf-token': actor.csrfToken } : {}),
    'x-temuevent-client': 'web', 'content-type': 'application/json', ...headers,
  }, body: JSON.stringify(body) })
  const reviewUrl = `/api/events/${ownEvent.id}/reviews`, eligibilityUrl = reviewUrl + '/eligibility'
  const attendanceUrl = `/api/organizer/events/${ownEvent.id}/attendance`
  const attendanceBody = { customerId: buyer.id, transactionId: confirmed.id }
  const reviewBody = { rating: 5, comment: 'A useful event with a welcoming organizer.' }
  const state = async actor => (await (await get(eligibilityUrl, actor)).json()).data

  assert.equal((await get(eligibilityUrl)).status, 401)
  assert.equal((await get(eligibilityUrl, ownerLogin)).status, 403)
  assert.equal((await get(eligibilityUrl + '?userId=' + buyer.id, outsiderLogin)).status, 400)
  assert.equal((await get('/api/events/not-a-uuid/reviews/eligibility', buyerLogin)).status, 400)
  assert.equal((await get(`/api/events/${draft.id}/reviews/eligibility`, buyerLogin)).status, 404)
  assert.equal((await state(outsiderLogin)).reason, 'PURCHASE_REQUIRED')
  assert.equal((await state(waitingLogin)).reason, 'PURCHASE_REQUIRED')
  assert.equal((await state(buyerLogin)).reason, 'ATTENDANCE_REQUIRED')
  assert.equal((await post(reviewUrl, buyerLogin, reviewBody)).status, 403)
  assert.equal((await post(reviewUrl, ownerLogin, reviewBody)).status, 403)
  assert.equal((await post(reviewUrl, buyerLogin, reviewBody, { 'x-csrf-token': '' })).status, 403)
  assert.equal((await post(reviewUrl, buyerLogin, { ...reviewBody, userId: second.id })).status, 400)
  for (const rating of [0, 6, 1.5, '5']) assert.equal((await post(reviewUrl, buyerLogin, { rating })).status, 400)
  assert.equal(await db.review.count(), 0)
  passed('Session-derived review eligibility, role/CSRF/input guards and forged identity denial')

  const attendeeUrl = `/api/organizer/events/${ownEvent.id}/attendees`
  const attendeeRows = (await (await get(attendeeUrl, ownerLogin)).json()).data
  assert.equal(attendeeRows.pagination.total, 3)
  assert.equal(attendeeRows.items.find(row => row.purchaseId === confirmed.id).ticketQuantity, 3)
  assert(!attendeeRows.items.some(row => row.purchaseId === waiting.id || row.purchaseId === foreign.id))
  assert.equal((await get(attendeeUrl, foreignLogin)).status, 404)
  assert.equal((await post(attendanceUrl, buyerLogin, attendanceBody)).status, 403)
  assert.equal((await post(attendanceUrl, foreignLogin, attendanceBody)).status, 404)
  assert.equal((await post(attendanceUrl, ownerLogin, { ...attendanceBody, customerId: second.id })).status, 404)
  assert.equal((await post(attendanceUrl, ownerLogin, { customerId: waitingBuyer.id, transactionId: waiting.id })).status, 404)
  assert.equal(await organizer.markAttendance(foreignOwner.id, ownEvent.id, buyer.id, confirmed.id), null)
  assert.equal(await db.attendance.count(), 0)
  passed('DONE-only populated attendee list, ticket quantities and repeated owner/registration checks')

  const markedResponse = await post(attendanceUrl, ownerLogin, attendanceBody)
  assert.equal(markedResponse.status, 200)
  const marked = (await markedResponse.json()).data
  assert.deepEqual((await (await post(attendanceUrl, ownerLogin, attendanceBody)).json()).data, marked)
  assert.equal(await db.attendance.count(), 1)
  assert.deepEqual(await state(buyerLogin), { eligible: true, reason: 'ELIGIBLE' })
  assert.equal((await state(secondLogin)).reason, 'ATTENDANCE_REQUIRED')
  assert.equal((await get(eligibilityUrl, buyerLogin)).headers.get('cache-control'), 'private, no-store')
  const updatedList = (await (await get(attendeeUrl, ownerLogin)).json()).data
  assert.equal(updatedList.items.find(row => row.purchaseId === confirmed.id).attendedAt, marked.attendedAt)
  passed('Idempotent owner attendance unlocks only the matching authenticated customer')

  const clientFor = actor => createAuthClient({ fetcher: (path, init) => {
    const headers = new Headers(init?.headers); headers.set('cookie', cookie(actor))
    return fetch(base + path, { ...init, headers })
  } })
  const client = clientFor(buyerLogin)
  await assert.rejects(client.submitEventReview(ownEvent.id, reviewBody, second.id), error => error instanceof AuthApiError && error.code === 'ACCOUNT_CHANGED')
  assert.equal(await db.review.count(), 0)
  const review = await client.submitEventReview(ownEvent.id, reviewBody, buyer.id)
  assert.equal(review.userId, buyer.id); assert.equal(review.rating, 5)
  assert.equal((await state(buyerLogin)).reason, 'ALREADY_REVIEWED')
  assert.equal((await post(reviewUrl, buyerLogin, reviewBody)).status, 409)
  const publicReviews = await (await get(reviewUrl)).json()
  assert.equal(publicReviews.data.length, 1); assert.equal(publicReviews.data[0].id, review.id)
  assert(!JSON.stringify(publicReviews).includes(buyer.email))
  passed('Authenticated browser client creates one persisted review; changed account and duplicate blocked')

  assert.equal((await post(attendanceUrl, ownerLogin, { customerId: second.id, transactionId: confirmed2.id })).status, 200)
  const duplicates = await Promise.all([post(reviewUrl, secondLogin, { rating: 4 }), post(reviewUrl, secondLogin, { rating: 4 })])
  assert.deepEqual(duplicates.map(response => response.status).sort(), [201, 409])
  assert.equal(await db.review.count(), 2)
  // Direct writer calls must enforce attendance, too; they cannot rely on HTTP prechecks.
  await assert.rejects(reviews.create({ eventId: ownEvent.id, userId: outsider.id, rating: 5 }), /PURCHASE_REQUIRED/)
  await assert.rejects(reviews.create({ eventId: ownEvent.id, userId: earlierBuyer.id, rating: 5 }), /ATTENDANCE_REQUIRED/)
  await assert.rejects(reviews.create({ eventId: draft.id, userId: buyer.id, rating: 5 }), /EVENT_NOT_FOUND/)
  await assert.rejects(reviews.create({ eventId: ownEvent.id, userId: buyer.id, rating: 5 }), /REVIEW_ALREADY_EXISTS/)
  passed('Concurrent duplicate requests yield one review; SQL writer repeats attendance/publication guards')

  const totalsBefore = await (await get('/api/organizer/statistics?groupBy=day&from=2026-11-11&to=2026-11-11', ownerLogin)).json()
  assert.deepEqual(totalsBefore.data.totals, { revenueIdr: 200000, purchaseCount: 2, ticketQuantity: 4 })
  for (const groupBy of ['month', 'year']) {
    const response = await get(`/api/organizer/statistics?groupBy=${groupBy}&from=2026-11-10&to=2026-11-11`, ownerLogin)
    assert.deepEqual((await response.json()).data.totals, { revenueIdr: 250000, purchaseCount: 3, ticketQuantity: 5 })
  }
  assert.equal(priorDay.completedAt.toISOString(), '2026-11-10T16:59:00.000Z')
  passed('Jakarta day/month/year totals count DONE purchases once across multiple items and exclude foreign/pending/rejected sales')

  assert.deepEqual(await reviews.organizerRating(owner.id), { average: 4.5, count: 2 })
  assert.deepEqual(await reviews.organizerRating(foreignOwner.id), { average: 0, count: 0 })
  assert.equal(await reviews.organizerRating(buyer.id), null)
  const profile = await (await get(`/api/profiles/organizers/${owner.id}`)).json()
  assert.deepEqual(profile.data.ratingSummary, { average: 4.5, count: 2 })
  const feed = await (await get(`/api/organizers/${owner.id}`)).json()
  assert.equal(feed.data.reviews.length, 2)
  const eventDetail = await (await get(`/api/events/${ownEvent.id}`)).json()
  assert.equal(eventDetail.data.rating, 4.5); assert.equal(eventDetail.data.reviewCount, 2)
  assert(!JSON.stringify(profile).includes(buyer.email))
  passed('F2 public organizer rating uses the published review aggregate; F1 public feed agrees')

  // A purchase changing after a successful eligibility read must not permit a stale insert.
  const eligibleEarlier = { customerId: earlierBuyer.id, transactionId: priorDay.id }
  assert.equal((await post(attendanceUrl, ownerLogin, eligibleEarlier)).status, 200)
  assert.equal((await reviews.eligibility(ownEvent.id, earlierBuyer.id)).eligible, true)
  await db.purchase.update({ where: { id: priorDay.id }, data: { status: 'REJECTED' } })
  await assert.rejects(reviews.create({ eventId: ownEvent.id, userId: earlierBuyer.id, rating: 5 }), /PURCHASE_REQUIRED/)
  assert.equal(await db.review.count(), 2)
  passed('A previously eligible customer cannot review after the anchored purchase ceases to be DONE')

  await db.purchase.update({ where: { id: priorDay.id }, data: { status: 'DONE' } })
  let posts = 0
  const lostActor = await login(earlierBuyer)
  const uncertainClient = createAuthClient({ fetcher: async (path, init) => {
    const headers = new Headers(init?.headers); headers.set('cookie', cookie(lostActor))
    const response = await fetch(base + path, { ...init, headers })
    if (String(path) === reviewUrl && init?.method === 'POST') { posts++; assert.equal(response.status, 201); throw new Error('Simulated response loss') }
    return response
  } })
  await assert.rejects(uncertainClient.submitEventReview(ownEvent.id, { rating: 3 }, earlierBuyer.id), error => error.code === 'REVIEW_SUBMISSION_UNCERTAIN')
  assert.equal(posts, 1); assert.equal(await db.review.count(), 3)
  assert.equal((await reviews.eligibility(ownEvent.id, earlierBuyer.id)).reason, 'ALREADY_REVIEWED')
  passed('A lost successful review response is reported as uncertain and is never automatically posted twice')

  const protectedFields = await db.$queryRaw`
    SELECT has_table_privilege(current_user, 'temuevent.attendance', 'UPDATE') AS attendance_update,
      has_table_privilege(current_user, 'temuevent.reviews', 'UPDATE') AS review_update`
  assert.equal(protectedFields[0].attendance_update, false); assert.equal(protectedFields[0].review_update, false)
  await auth.service.logout(buyerLogin.refreshToken)
  assert.equal((await get(eligibilityUrl, buyerLogin)).status, 401)
  passed('Runtime retains append-only attendance/review permissions and revoked sessions lose eligibility access')
  evidence.fixtureCounts = { users: await db.user.count(), events: await db.event.count(), purchases: await db.purchase.count(),
    attendance: await db.attendance.count(), reviews: await db.review.count() }
  evidence.result = 'PASS'
  if (args.length) {
    const output = resolve(args[1]); await mkdir(dirname(output), { recursive: true })
    await writeFile(output + '.tmp', JSON.stringify(evidence, null, 2) + '\n'); await rename(output + '.tmp', output)
  }
  console.log('ROUND6_COMPLETE:', JSON.stringify({ scenarios: evidence.scenarios.length, ...evidence.fixtureCounts }))
} finally {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  await Promise.allSettled([eventDb?.$disconnect(), db?.$disconnect()])
  await pool?.end(); await socket?.stop(); await pg.close()
}
