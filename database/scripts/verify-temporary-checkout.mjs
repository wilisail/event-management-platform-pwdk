import assert from 'node:assert/strict'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { PrismaPg } from '@prisma/adapter-pg'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('../../feature-2/generated/prisma/client.ts')
const { createRuntime } = require('../../feature-2/server/runtime.ts')
const { createApp } = require('../../server/app.ts')
const { readPublishedEventById, readEventReviews, createEventWriter } = require('../../server/database.ts')
const { prismaEventReviewRepository } = require('../../feature-2/server/organizer/event-reviews.ts')
const { hashPassword } = require('../../feature-2/server/auth/passwords.ts')
const { rewardFixture } = require('../../feature-2/scripts/helpers/reward-fixtures.ts')
const sharp = createRequire(new URL('../../feature-2/package.json', import.meta.url))('sharp')
const serve = process.argv.includes('--serve'), reportAt = process.argv.indexOf('--report')
const report = { scope: 'TEMPORARY_F2_CHECKOUT_ISOLATED', checkedAt: new Date().toISOString(),
  liveDatabaseUsed: false, liveStorageUsed: false, externalEmailSent: false, manualAcceptance: false,
  concurrencyLimit: 'Concurrent requests share one disposable physical SQL connection; independent-session races are not claimed.', scenarios: [] }
const passed = name => { report.scenarios.push(name); console.log('TEMP_CHECKOUT_OK:', name) }
const pg = await PGlite.create()
let db, socket, server, keep = false
try {
  await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;')
  const migrations = new URL('../prisma/migrations/', import.meta.url)
  const names = (await readdir(migrations, { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name).sort()
  for (const name of names) await pg.exec(await readFile(new URL(name + '/migration.sql', migrations), 'utf8'))
  socket = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 0 }); await socket.start()
  db = new PrismaClient({ adapter: new PrismaPg({ connectionString: `postgresql://postgres@${socket.getServerConn()}/postgres`, max: 1, ssl: false }) })
  await db.$executeRaw`SET ROLE temuevent_app`
  const [{ at }] = await db.$queryRaw`SELECT clock_timestamp() AS at`
  const password = 'temporary checkout disposable test password', passwordHash = await hashPassword(password)
  const files = new Map(), messages = []
  let failUpload = false
  const storage = {
    read: async key => files.get(key) ?? null,
    write: async (key, value) => { if (failUpload) throw new Error('isolated storage fault'); files.set(key, value) },
    remove: async key => { files.delete(key) },
  }
  const runtime = await createRuntime({ client: db, paymentProofStorage: storage, mailer: { send: async message => { messages.push(message) } },
    fallthrough: true, allowedOrigins: ['http://127.0.0.1:3000', 'http://127.0.0.1:3002'],
    env: { AUTH_JWT_SECRET: 'ab'.repeat(32), F2_JOB_RUNNER_SECRET: 'cd'.repeat(32),
      F2_PASSWORD_RESET_ORIGIN: 'http://localhost:3001', F2_DECISION_EMAIL_WORKER_ENABLED: 'true' } })
  const review = prismaEventReviewRepository(db)
  const app = createApp({ accountApi: runtime.app, sessionService: runtime.sessionService, secureCookies: false,
    allowedOrigins: ['http://127.0.0.1:3000', 'http://127.0.0.1:3002'],
    eventCreator: createEventWriter(db), eventReader: id => readPublishedEventById(id, db),
    reviewReader: id => readEventReviews(id, db), reviewEligibility: review.eligibility, reviewCreator: review.create })
  const browserFixtures = []
  const harness = require('express')()
  if (serve) {
    harness.get('/__isolated-fixtures', (_req, res) => res.json({ fixtures: browserFixtures }))
  }
  harness.use(app)
  server = harness.listen(serve ? Number(process.env.TEMP_CHECKOUT_PORT || 4003) : 0, '127.0.0.1'); await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  async function fixture(tag) {
    const f = await db.$transaction(tx => rewardFixture(tx, at, 'temporary-checkout-' + tag.toLowerCase() + '-' + randomUUID()))
    await db.user.updateMany({ where: { id: { in: [f.owner.id, f.other.id, f.organizer.id] } }, data: { passwordHash } })
    f.buyer = await runtime.sessionService.login({ email: f.owner.email, password })
    f.seller = await runtime.sessionService.login({ email: f.organizer.email, password })
    f.stranger = await runtime.sessionService.login({ email: f.other.email, password })
    return f
  }
  const cookie = session => `temuevent_access=${session.accessToken}; temuevent_refresh=${session.refreshToken}`
  const headers = (session, mutate = false) => ({ ...(session ? { cookie: cookie(session) } : {}),
    ...(mutate ? { 'x-temuevent-client': 'web', 'x-csrf-token': session.csrfToken } : {}) })
  const get = (path, session) => fetch(base + path, { headers: headers(session) })
  const post = (path, value, session) => fetch(base + path, { method: 'POST', headers: { ...headers(session, true), 'content-type': 'application/json' }, body: JSON.stringify(value) })
  const inputFor = (f, overrides = {}) => ({ purchaseId: randomUUID(), eventId: f.event.id,
    items: [{ ticketTypeId: f.ticket.id, quantity: 1 }], pointsRequested: 5000, couponId: f.coupon.id,
    expectedSubtotal: 100000, expectedTotal: 70000, ...overrides })
  async function create(f, input = inputFor(f)) {
    const response = await post('/api/checkout/purchases', input, f.buyer)
    const body = await response.json(); assert.equal(response.status, 201, JSON.stringify(body)); return { input, value: body.data }
  }
  const proof = await sharp({ create: { width: 320, height: 160, channels: 3, background: '#5148df' } }).png().toBuffer()
  const upload = (f, id, session = f.buyer, bytes = proof, type = 'image/png') => fetch(`${base}/api/me/purchases/${id}/proof`, {
    method: 'POST', headers: { ...headers(session, true), 'content-type': type }, body: bytes })
  const decide = (f, id, decision) => post(`/api/organizer/transactions/${id}/decision`, { decision }, f.seller)
  const worker = () => fetch(base + '/api/internal/jobs/run', { method: 'POST', headers: { authorization: 'Bearer ' + 'cd'.repeat(32) } })
  const a = await fixture('accept'), ai = inputFor(a)
  assert.equal((await get('/api/me/purchases')).status, 401)
  assert.equal((await post('/api/checkout/purchases', ai, a.seller)).status, 403)
  assert.equal((await fetch(base + '/api/checkout/purchases', { method: 'POST', headers: { ...headers(a.buyer), 'content-type': 'application/json' }, body: JSON.stringify(ai) })).status, 403)
  assert.equal((await post('/api/checkout/purchases', { ...ai, totalPrice: 1 }, a.buyer)).status, 400)
  assert.equal((await post('/api/checkout/purchases', { ...ai, expectedTotal: 1 }, a.buyer)).status, 409)
  assert.equal(await db.purchase.count(), 0)
  passed('Customer role, CSRF, strict input and authoritative pricing reject invalid checkout without writes')

  const made = await create(a, ai), id = made.value.id
  assert.equal(made.value.status, 'WAITING_FOR_PAYMENT'); assert.equal(made.value.totalPrice, 70000)
  assert.equal((await db.ticketType.findUniqueOrThrow({ where: { id: a.ticket.id } })).availableSeats, 99)
  const deadlineMs = Date.parse(made.value.paymentDueAt) - Date.parse(made.value.serverTime)
  assert(deadlineMs > 7190000 && deadlineMs <= 7200000)
  const reserved = await db.rewardRedemption.findUniqueOrThrow({ where: { purchaseId: id } })
  assert.equal(reserved.status, 'RESERVED'); assert.equal(reserved.pointsUsed, 5000n)
  assert.equal((await post('/api/checkout/purchases', ai, a.buyer)).status, 201)
  assert.equal(await db.purchase.count(), 1)
  assert.equal((await db.ticketType.findUniqueOrThrow({ where: { id: a.ticket.id } })).availableSeats, 99)
  assert.equal((await post('/api/checkout/purchases', { ...ai, items: [{ ticketTypeId: a.ticket.id, quantity: 2 }] }, a.buyer)).status, 409)
  assert.equal((await get(`/api/me/purchases/${id}`, a.stranger)).status, 404)
  assert.equal((await upload(a, id, a.stranger)).status, 404)
  const saved = await (await get(`/api/me/purchases/${id}`, a.buyer)).json()
  assert.equal(saved.data.totalPrice, 70000); assert(!JSON.stringify(saved).includes('paymentProofKey'))
  const ownList = (await (await get('/api/me/purchases', a.buyer)).json()).data
  assert.deepEqual(ownList.map(p => p.id), [id])
  assert.equal((await (await get('/api/me/purchases', a.stranger)).json()).data.length, 0)
  passed('Persisted purchase reserves one seat, real points/coupon and two-hour deadline; retries do not double spend')

  assert.equal((await upload(a, id, a.buyer, Buffer.from('invalid'), 'image/png')).status, 400)
  failUpload = true; assert.equal((await upload(a, id)).status, 503); failUpload = false
  assert.equal((await db.purchase.findUniqueOrThrow({ where: { id } })).status, 'WAITING_FOR_PAYMENT')
  assert.equal(files.size, 0)
  const uploaded = await upload(a, id), uploadedBody = await uploaded.json()
  assert.equal(uploaded.status, 200, JSON.stringify(uploadedBody)); assert.equal(uploadedBody.data.status, 'WAITING_FOR_ADMIN_CONFIRMATION')
  assert.equal(Date.parse(uploadedBody.data.decisionDueAt) - Date.parse(uploadedBody.data.proofUploadedAt), 3 * 86400000)
  assert.equal(files.size, 1); assert.equal([...files.values()][0].contentType, 'image/jpeg')
  assert.equal((await upload(a, id)).status, 200); assert.equal(files.size, 1)
  assert.equal((await get(`/api/me/purchases/${id}/proof`, a.stranger)).status, 404)
  assert.equal((await get(`/api/me/purchases/${id}/proof`)).status, 401)
  const privateProof = await get(`/api/organizer/transactions/${id}/proof`, a.seller)
  assert.equal(privateProof.status, 200); assert.equal(privateProof.headers.get('cache-control'), 'private, no-store')
  passed('Validated private proof survives reload, reaches Organizer and starts three-day decision deadline; failed uploads leave no attachment')

  assert.equal((await decide(a, id, 'ACCEPT')).status, 200)
  const confirmed = (await (await get(`/api/me/purchases/${id}`, a.buyer)).json()).data
  assert.equal(confirmed.status, 'DONE')
  assert.equal((await db.rewardRedemption.findUniqueOrThrow({ where: { purchaseId: id } })).status, 'CONSUMED')
  const attendees = await (await get(`/api/organizer/events/${a.event.id}/attendees`, a.seller)).json()
  assert.equal(attendees.data.items[0].ticketQuantity, 1)
  const sentReview = await post(`/api/events/${a.event.id}/reviews`, { rating: 4, comment: 'Persisted checkout review', reportedAttendance: false }, a.buyer)
  assert.equal(sentReview.status, 201, JSON.stringify(await sentReview.json()))
  assert.equal((await post(`/api/events/${a.event.id}/reviews`, { rating: 5 }, a.buyer)).status, 409)
  assert.equal(await db.attendance.count(), 0)
  assert.equal(await db.organizerDecisionEmail.count({ where: { purchaseId: id } }), 1)
  assert.equal((await post('/api/checkout/purchases', ai, a.buyer)).status, 201)
  passed('Saved Customer purchase flows through real Organizer approval, confirmed participant, reward consumption and optional-attendance review')

  const r = await fixture('reject'), rejected = await create(r)
  assert.equal((await upload(r, rejected.value.id)).status, 200)
  assert.equal((await decide(r, rejected.value.id, 'REJECT')).status, 200)
  assert.equal((await db.ticketType.findUniqueOrThrow({ where: { id: r.ticket.id } })).availableSeats, 100)
  assert.equal((await db.pointGrant.findUniqueOrThrow({ where: { id: r.grants[0].id } })).remainingAmount, 10000n)
  assert.equal((await db.rewardRedemption.findUniqueOrThrow({ where: { purchaseId: rejected.value.id } })).status, 'RESTORED')
  const restoredWallet = (await (await get('/api/me/rewards', r.buyer)).json()).data
  assert.equal(restoredWallet.coupons.items.find(c => c.id === r.coupon.id).status, 'AVAILABLE')
  passed('Rejection restores original seats, points and referral coupon through existing F2 accounting')

  for (const status of ['EXPIRED', 'CANCELED']) {
    const f = await fixture(status), p = await create(f)
    if (status === 'CANCELED') assert.equal((await upload(f, p.value.id)).status, 200)
    await db.purchase.update({ where: { id: p.value.id }, data: status === 'EXPIRED'
      ? { paymentDueAt: new Date(+at - 1000) } : { decisionDueAt: new Date(+at - 1000) } })
    if (status === 'EXPIRED') assert.equal((await upload(f, p.value.id)).status, 409)
    assert.equal((await worker()).status, 200)
    assert.equal((await db.purchase.findUniqueOrThrow({ where: { id: p.value.id } })).status, status)
    assert.equal((await db.ticketType.findUniqueOrThrow({ where: { id: f.ticket.id } })).availableSeats, 100)
    assert.equal((await worker()).status, 200)
    assert.equal((await db.ticketType.findUniqueOrThrow({ where: { id: f.ticket.id } })).availableSeats, 100)
  }
  passed('Existing scheduled worker expires/cancels newly created purchases and restores reservations once')

  const free = await fixture('free')
  await db.ticketType.update({ where: { id: free.ticket.id }, data: { price: 0n } })
  const freeInput = inputFor(free, { expectedSubtotal: 0, expectedTotal: 0, pointsRequested: 0, couponId: null })
  const freePurchase = await create(free, freeInput)
  assert.equal(freePurchase.value.status, 'DONE'); assert.equal(freePurchase.value.paymentDueAt, null)
  assert.equal((await upload(free, freePurchase.value.id)).status, 409)
  const covered = await fixture('covered')
  await db.ticketType.update({ where: { id: covered.ticket.id }, data: { price: 20000n } })
  const coveredPurchase = await create(covered, inputFor(covered, { expectedSubtotal: 20000, expectedTotal: 0, pointsRequested: 0 }))
  assert.equal(coveredPurchase.value.status, 'DONE')
  assert.equal((await db.rewardRedemption.findUniqueOrThrow({ where: { purchaseId: coveredPurchase.value.id } })).status, 'CONSUMED')
  passed('Free and fully discounted tickets become DONE atomically without asking for a payment proof')

  const last = await fixture('last-seat')
  await db.ticketType.update({ where: { id: last.ticket.id }, data: { quota: 1, availableSeats: 1 } })
  const attempts = await Promise.all([1, 2].map(() => post('/api/checkout/purchases', inputFor(last), last.buyer)))
  assert.deepEqual(attempts.map(r => r.status).sort(), [201, 409])
  assert.equal((await db.ticketType.findUniqueOrThrow({ where: { id: last.ticket.id } })).availableSeats, 0)
  const oldEvent = await fixture('past-event')
  await db.event.update({ where: { id: oldEvent.event.id }, data: { startAt: new Date(+at - 7200000), endAt: new Date(+at - 3600000) } })
  assert.equal((await post('/api/checkout/purchases', inputFor(oldEvent), oldEvent.buyer)).status, 409)
  assert.equal((await db.ticketType.findUniqueOrThrow({ where: { id: oldEvent.ticket.id } })).availableSeats, 100)
  passed('Last-seat attempts cannot oversell; ended events reject checkout without reserving rewards or stock')
  assert.equal(messages.length, 2)
  report.migrationsReplayed = names.length
  if (reportAt !== -1) await writeFile(process.argv[reportAt + 1], JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report))
  if (serve) {
    for (const width of [1280, 360, 320]) {
      const f = await fixture('browser-' + width)
      browserFixtures.push({ width, eventId: f.event.id, ticketId: f.ticket.id, couponId: f.coupon.id,
        customerId: f.owner.id, email: f.owner.email, organizerEmail: f.organizer.email, password })
    }
    keep = true
    console.log('TEMP_CHECKOUT_ISOLATED_SERVER=' + base)
    const stop = async () => { server.close(); await db.$disconnect(); await socket.stop(); await pg.close(); process.exit(0) }
    process.once('SIGTERM', stop); process.once('SIGINT', stop)
  }
} finally {
  if (!keep) { if (server) await new Promise(resolve => server.close(resolve)); await db?.$disconnect(); await socket?.stop(); await pg.close() }
}
