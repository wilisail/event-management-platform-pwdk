import assert from 'node:assert/strict'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { readFile, readdir, writeFile, rename, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { PrismaPg } from '@prisma/adapter-pg'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('../../feature-2/generated/prisma/client.ts')
const { createApp } = require('../../feature-2/server/app.ts')
const { prismaOrganizerReadRepository } = require('../../feature-2/server/organizer/read-repository.ts')
const { prismaOrganizerProofReader } = require('../../feature-2/server/organizer/private-proof.ts')
const { customerRewards } = require('../../feature-2/server/rewards/operations.ts')
const { prismaRewardReadRepository } = require('../../feature-2/server/rewards/read-repository.ts')
const { createDecisionEmailWorker } = require('../../feature-2/server/email/organizer-decision.ts')
const { prismaDecisionEmailRepository } = require('../../feature-2/server/email/organizer-decision-repository.ts')
const { MailDeliveryError } = require('../../feature-2/server/email/resend.ts')
const { sessionFixture, testAccount, loginFields } = require('../../feature-2/tests/helpers/sessions.ts')
const { rewardFixture, testCheckout } = require('../../feature-2/scripts/helpers/reward-fixtures.ts')
const { round5QaTransitions } = require('../qa/round5-adapters.ts')
const { installRound5Review } = require('../qa/round5-review.ts')
const express = require('express')

const reportIndex = process.argv.indexOf('--report')
const serve = process.argv.includes('--serve')
if (process.argv.slice(2).some((value, index, args) => !['--report', '--serve'].includes(value) && args[index - 1] !== '--report')) {
  throw new Error('Usage: verify-round5-isolated.mjs [--report PATH] [--serve]')
}
if (reportIndex !== -1 && (!process.argv[reportIndex + 1] || process.argv[reportIndex + 1].startsWith('--'))) throw new Error('Missing report path')

// No .env, shared/project database, storage provider or SMTP credentials are read.
const pg = await PGlite.create()
let socket, db, server
let reviewTimer
const evidence = { checkedAt: new Date().toISOString(), scope: 'ISOLATED_F2_QA', productionAdapter: false,
  liveDatabaseUsed: false, liveStorageUsed: false, externalEmailSent: false, ownerStandbyRequired: false,
  scenarios: [], fullF1JourneyAccepted: false, eventVoucherQuotaVerified: false, realInboxConfirmed: false }
const passed = name => { evidence.scenarios.push(name); console.log('ROUND5_OK:', name) }

try {
  await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;')
  const root = new URL('../prisma/migrations/', import.meta.url)
  const migrations = (await readdir(root, { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name).sort()
  for (const name of migrations) await pg.exec(await readFile(new URL(name + '/migration.sql', root), 'utf8'))
  socket = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 0 }); await socket.start()
  db = new PrismaClient({ adapter: new PrismaPg({ connectionString: `postgresql://postgres@${socket.getServerConn()}/postgres`,
    max: 1, connectionTimeoutMillis: 5000, ssl: false }) })
  await db.$executeRaw`SET ROLE temuevent_app`
  evidence.migrationsReplayed = migrations.length
  evidence.databaseConcurrency = 'Concurrent HTTP requests serialized through one disposable PostgreSQL connection; live two-session races remain separate.'
  const auth = sessionFixture()
  if (serve) auth.advance(Date.now() - +auth.now())
  const originTime = auth.now()
  let clock = new Date(originTime)
  const now = () => new Date(clock)
  const png = serve
    ? await createRequire(new URL('../../feature-2/package.json', import.meta.url))('sharp')(Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="420"><rect width="720" height="420" fill="#f5f2ff"/><rect x="30" y="30" width="660" height="360" rx="24" fill="white" stroke="#6554dc"/><text x="65" y="105" font-size="32" font-family="sans-serif" fill="#30235f">TemuEvent — QA payment proof</text><text x="65" y="190" font-size="44" font-family="sans-serif" fill="#6554dc">Rp70,000 — TEST ONLY</text><text x="65" y="270" font-size="24" font-family="sans-serif" fill="#30235f">No money transferred.</text><text x="65" y="320" font-size="22" font-family="sans-serif" fill="#30235f">Disposable Round 5 verification fixture.</text></svg>')).png().toBuffer()
    : Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
  const files = new Map(), cases = []
  async function makeCase(label, { proof = true, free = false } = {}) {
    const f = await db.$transaction(tx => rewardFixture(tx, now(), 'round5-' + label + '-' + randomUUID()))
    const purchase = await db.$transaction(async tx => {
      const rewards = await customerRewards(tx, f.owner.id, { now })
      const made = await testCheckout(tx, f, rewards, { pointsRequested: free ? 0 : 5000, couponId: f.coupon.id,
        subtotal: free ? 10000 : 100000 })
      const key = 'private-round5-fixture/' + randomUUID() + '.png'
      await tx.purchase.update({ where: { id: made.purchaseId }, data: {
        reference: 'ROUND5-QA-' + made.purchaseId,
        ...(proof && !free ? { status: 'WAITING_FOR_ADMIN_CONFIRMATION', proofUploadedAt: now(),
          decisionDueAt: new Date(+now() + 3 * 86400000), paymentProofKey: key } : {}),
      } })
      if (proof && !free) files.set(key, { bytes: png, contentType: 'image/png' })
      return made
    })
    const fixture = { ...f, purchaseId: purchase.purchaseId, eventId: f.event.id, customerId: f.owner.id,
      organizerId: f.organizer.id, label }
    for (const user of [f.owner, f.other, f.organizer]) auth.users.set(user.email, { ...testAccount, ...user,
      profilePictureUrl: null, passwordHash: 'test-only:' + loginFields.password })
    cases.push(fixture); return fixture
  }
  const accepted = await makeCase('accept'), rejected = await makeCase('reject'), rollback = await makeCase('rollback')
  const uncertain = await makeCase('lost-response'), raced = await makeCase('repeat-race')
  const deadline = await makeCase('decision-deadline'), unpaid = await makeCase('payment-expiry', { proof: false })
  const canceled = await makeCase('organizer-cancellation'), expiredRewards = await makeCase('expired-rewards', { proof: false })
  const noProof = await makeCase('no-proof', { proof: false }), free = await makeCase('zero-price', { proof: false, free: true })
  let reviewAccept, reviewReject
  if (serve) {
    reviewAccept = await makeCase('manual-accept'); reviewReject = await makeCase('manual-reject')
    await db.event.update({ where: { id: reviewAccept.event.id }, data: { name: 'Round 5 — Terima pembayaran' } })
    await db.event.update({ where: { id: reviewReject.event.id }, data: {
      name: 'Round 5 — Tolak pembayaran', organizerId: reviewAccept.organizer.id,
    } })
    reviewReject.organizer = reviewAccept.organizer; reviewReject.organizerId = reviewAccept.organizer.id
  }
  await assert.rejects(db.purchase.update({ where: { id: noProof.purchaseId }, data: {
    status: 'WAITING_FOR_ADMIN_CONFIRMATION', decisionDueAt: new Date(+now() + 86400000),
  } }), /purchases_review_deadline_check/)
  const rollbackFault = new Set([rollback.purchaseId]), lostResponse = new Set([uncertain.purchaseId])
  const adapter = round5QaTransitions(db, cases, { now,
    beforeCommit: id => { if (rollbackFault.has(id)) throw new Error('QA rollback after accounting/outbox') },
    afterCommit: id => { if (lostResponse.delete(id)) throw new Error('QA lost response after commit') },
  })
  let storageReads = 0
  const proofReader = prismaOrganizerProofReader(db, { async read(key) { storageReads++; return files.get(key) ?? null } })
  const rewardRepository = prismaRewardReadRepository(db, work => db.$transaction(work, { isolationLevel: 'RepeatableRead' }))
  const app = createApp({ secureCookies: false, now, sessionService: auth.service,
    allowedOrigins: ['http://127.0.0.1:3305', 'http://127.0.0.1:4405'],
    organizerRepository: prismaOrganizerReadRepository(db), organizerDecisionTransition: adapter.decide,
    organizerProofReader: proofReader, rewardRepository })
  const reviewHost = express()
  let reviewing = false
  reviewHost.use((_req, _res, next) => {
    if (reviewing) { auth.advance(Date.now() - +auth.now()); clock = auth.now() }
    next()
  })
  const delivered = new Map()
  if (serve) installRound5Review(reviewHost, { auth, db, accept: reviewAccept, reject: reviewReject,
    delivered, webOrigin: 'http://127.0.0.1:3305' })
  reviewHost.use(app)
  server = reviewHost.listen(serve ? 4405 : 0, '127.0.0.1'); await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  const login = async user => auth.service.login({ ...loginFields, email: user.email })
  const cookie = value => `temuevent_access=${value.accessToken}; temuevent_refresh=${value.refreshToken}`
  const get = (path, user) => fetch(base + path, { headers: user ? { cookie: cookie(user) } : {} })
  const decide = (f, user, decision, overrides = {}) => fetch(base + '/api/organizer/transactions/' + f.purchaseId + '/decision', {
    method: 'POST', headers: { cookie: cookie(user), 'x-csrf-token': user.csrfToken,
      'x-temuevent-client': 'web', 'content-type': 'application/json', ...overrides }, body: JSON.stringify({ decision }),
  })
  const status = f => db.purchase.findUniqueOrThrow({ where: { id: f.purchaseId } })
  const claim = f => db.rewardRedemption.findUniqueOrThrow({ where: { purchaseId: f.purchaseId } })
  const seats = async f => (await db.ticketType.findUniqueOrThrow({ where: { id: f.ticket.id } })).availableSeats
  const ownerLogin = await login(accepted.organizer), otherLogin = await login(rejected.organizer), buyerLogin = await login(accepted.owner)
  const detailUrl = '/api/organizer/transactions/' + accepted.purchaseId
  assert.equal((await get(detailUrl)).status, 401)
  assert.equal((await get(detailUrl, buyerLogin)).status, 403)
  assert.equal((await get(detailUrl, otherLogin)).status, 404)
  const detail = await (await get(detailUrl, ownerLogin)).json()
  assert.equal(detail.data.decisionAvailability, 'READY'); assert.equal(detail.data.proofAvailability, 'READY')
  assert(!JSON.stringify(detail).includes('private-round5-fixture/'))
  const proof = await get(detailUrl + '/proof', ownerLogin)
  assert.equal(proof.status, 200); assert.deepEqual(Buffer.from(await proof.arrayBuffer()), png)
  assert.equal(proof.headers.get('cache-control'), 'private, no-store')
  assert.equal((await get(detailUrl + '/proof', otherLogin)).status, 404)
  assert.equal((await get(detailUrl + '/proof', buyerLogin)).status, 403)
  assert.equal(storageReads, 1)
  // The storage adapter independently repeats the database owner predicate.
  assert.equal(await proofReader(rejected.organizer.id, accepted.purchaseId), null); assert.equal(storageReads, 1)
  passed('Private proof bytes, session/role/owner isolation and object-key redaction')

  assert.equal((await decide(accepted, buyerLogin, 'ACCEPT')).status, 403)
  assert.equal((await decide(accepted, otherLogin, 'ACCEPT')).status, 404)
  assert.equal((await decide(accepted, ownerLogin, 'ACCEPT', { 'x-csrf-token': otherLogin.csrfToken })).status, 403)
  assert.equal((await status(accepted)).status, 'WAITING_FOR_ADMIN_CONFIRMATION')
  assert.equal(await db.organizerDecisionEmail.count(), 0)
  passed('Decision ownership, Customer denial and CSRF guards leave accounting unchanged')

  assert.equal((await decide(accepted, ownerLogin, 'ACCEPT')).status, 200)
  assert.equal((await decide(accepted, ownerLogin, 'ACCEPT')).status, 409)
  assert.equal((await status(accepted)).status, 'DONE'); assert.equal((await claim(accepted)).status, 'CONSUMED')
  assert.equal(await seats(accepted), 99)
  const acceptedWallet = await (await get('/api/me/rewards', buyerLogin)).json()
  assert.equal(acceptedWallet.data.availablePoints, 15000); assert.equal(acceptedWallet.data.availableCouponCount, 0)
  assert.equal(await db.organizerDecisionEmail.count({ where: { purchaseId: accepted.purchaseId } }), 1)
  passed('Approval consumes real F2 rewards once; buyer wallet/status, seat hold and one outbox job match')

  const rejectLogin = await login(rejected.organizer)
  assert.equal((await decide(rejected, rejectLogin, 'REJECT')).status, 200)
  assert.equal((await decide(rejected, rejectLogin, 'REJECT')).status, 409)
  assert.equal((await status(rejected)).status, 'REJECTED'); assert.equal((await claim(rejected)).status, 'RESTORED')
  assert.equal(await seats(rejected), 100)
  const rejectedWallet = await rewardRepository.wallet(rejected.owner.id, now(), { pointPage: 1, couponPage: 1, pageSize: 10 })
  assert.equal(rejectedWallet.availablePoints, 20000); assert.equal(rejectedWallet.availableCouponCount, 1)
  assert.equal((await db.pointGrant.findUniqueOrThrow({ where: { id: rejected.grants[0].id } })).expiresAt.toISOString(), rejected.grants[0].expiresAt.toISOString())
  passed('Rejection restores original point batches, coupon and seat once without extending expiry')

  const rollbackLogin = await login(rollback.organizer)
  assert.equal((await decide(rollback, rollbackLogin, 'REJECT')).status, 503)
  assert.equal((await status(rollback)).status, 'WAITING_FOR_ADMIN_CONFIRMATION')
  assert.equal((await claim(rollback)).status, 'RESERVED'); assert.equal(await seats(rollback), 99)
  assert.equal(await db.organizerDecisionEmail.count({ where: { purchaseId: rollback.purchaseId } }), 0)
  rollbackFault.clear()
  assert.equal((await decide(rollback, rollbackLogin, 'REJECT')).status, 200)
  passed('Injected transaction failure rolls back status, reward, seat and email atomically; retry succeeds')

  const uncertainLogin = await login(uncertain.organizer)
  const lost = await decide(uncertain, uncertainLogin, 'ACCEPT')
  assert.equal(lost.status, 503); assert.equal((await lost.json()).code, 'DECISION_UNCERTAIN')
  assert.equal((await status(uncertain)).status, 'DONE')
  assert.equal((await decide(uncertain, uncertainLogin, 'ACCEPT')).status, 409)
  assert.equal(await seats(uncertain), 99)
  assert.equal(await db.organizerDecisionEmail.count({ where: { purchaseId: uncertain.purchaseId } }), 1)
  passed('Lost response after commit is resolved by reads; retries do not double-account or notify')

  const raceLogin = await login(raced.organizer)
  const results = await Promise.all([decide(raced, raceLogin, 'ACCEPT'), decide(raced, raceLogin, 'REJECT')])
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409])
  const terminal = (await status(raced)).status
  assert.equal((await claim(raced)).status, terminal === 'DONE' ? 'CONSUMED' : 'RESTORED')
  assert.equal(await seats(raced), terminal === 'DONE' ? 99 : 100)
  assert.equal(await db.organizerDecisionEmail.count({ where: { purchaseId: raced.purchaseId } }), 1)
  passed('Concurrent HTTP accept/reject requests yield one terminal transition and one email job')

  assert.equal((await decide(noProof, await login(noProof.organizer), 'ACCEPT')).status, 409)
  const deadlineLogin = await login(deadline.organizer)
  clock = new Date(+originTime + 1000)
  await db.purchase.update({ where: { id: deadline.purchaseId }, data: { decisionDueAt: now() } })
  assert.equal((await decide(deadline, deadlineLogin, 'ACCEPT')).status, 409)
  assert.equal(await adapter.cancel(deadline.purchaseId), 'APPLIED')
  assert.equal(await adapter.cancel(deadline.purchaseId), 'CLOSED')
  assert.equal(await seats(deadline), 100)
  assert.equal(await adapter.expire(unpaid.purchaseId), 'CLOSED')
  clock = new Date(+originTime + 7200000)
  assert.equal(await adapter.expire(unpaid.purchaseId), 'APPLIED')
  assert.equal(await adapter.expire(unpaid.purchaseId), 'CLOSED')
  assert.equal((await status(unpaid)).status, 'EXPIRED'); assert.equal(await seats(unpaid), 100)
  clock = new Date(+originTime + 3 * 86400000)
  assert.equal(await adapter.cancel(canceled.purchaseId), 'APPLIED')
  assert.equal(await adapter.cancel(canceled.purchaseId), 'CLOSED')
  assert.equal((await status(canceled)).status, 'CANCELED'); assert.equal(await seats(canceled), 100)
  passed('Missing proof and exact deadlines cannot approve; two-hour expiry and three-day cancellation restore once')

  clock = new Date(+originTime + 91 * 86400000)
  assert.equal(await adapter.expire(expiredRewards.purchaseId), 'APPLIED')
  const oldWallet = await rewardRepository.wallet(expiredRewards.owner.id, now(), { pointPage: 1, couponPage: 1, pageSize: 10 })
  assert.equal(oldWallet.availablePoints, 0); assert.equal(oldWallet.availableCouponCount, 0)
  assert.equal(oldWallet.coupons.items[0].status, 'EXPIRED')
  assert.equal(await seats(expiredRewards), 100)
  assert.equal(await adapter.decide({ organizerId: accepted.organizer.id, transactionId: randomUUID(), decision: 'ACCEPT' }), 'NOT_FOUND')
  clock = new Date(originTime)
  assert.equal((await status(free)).status, 'DONE'); assert.equal((await claim(free)).status, 'CONSUMED')
  assert.equal(await seats(free), 99); assert.equal(await db.organizerDecisionEmail.count({ where: { purchaseId: free.purchaseId } }), 0)
  passed('Restored expired rewards remain unspendable; QA allowlist rejects unknown IDs; zero-price fixture consumes immediately')

  const attempts = []
  let first = true
  const worker = createDecisionEmailWorker(prismaDecisionEmailRepository(db), { async send(message) {
    attempts.push({ ...message })
    if (first) { first = false; throw new MailDeliveryError(429) }
    if (!delivered.has(message.idempotencyKey)) delivered.set(message.idempotencyKey, message)
  } })
  await worker.dispatchPending(); await worker.dispatchPending()
  const retry = await db.organizerDecisionEmail.findFirstOrThrow({ where: { deliveryState: 'RETRY' } })
  await db.organizerDecisionEmail.update({ where: { id: retry.id }, data: { nextAttemptAt: new Date(0) } })
  await worker.dispatchPending()
  const totalJobs = await db.organizerDecisionEmail.count()
  assert.equal(await db.organizerDecisionEmail.count({ where: { deliveryState: 'ACCEPTED' } }), totalJobs)
  const beforeRepeat = attempts.length
  await worker.dispatchPending(); assert.equal(attempts.length, beforeRepeat)
  assert.equal(delivered.size, totalJobs)
  const retried = attempts.filter(m => m.idempotencyKey === 'organizer-decision/' + retry.id)
  assert.equal(retried.length, 2); assert.deepEqual(retried[0], retried[1])
  evidence.decisionEmailJobs = totalJobs; evidence.capturedEmailAttempts = attempts.length
  passed('Real durable F2 email worker retries with stable payload/key and stops after recorded acceptance; transport captured only')

  const stats = await (await get('/api/organizer/statistics', ownerLogin)).json()
  assert.equal(stats.data.totals.purchaseCount, 1); assert.equal(stats.data.totals.ticketQuantity, 1)
  assert.equal(stats.data.totals.revenueIdr, 70000)
  const attendee = await (await get(`/api/organizer/events/${accepted.event.id}/attendees`, ownerLogin)).json()
  assert.equal(attendee.data.items.length, 1); assert.equal(attendee.data.items[0].customerId, accepted.owner.id)
  passed('Committed approval appears in real owner-scoped attendee and revenue queries')
  evidence.fixturePurchases = cases.length; evidence.passed = true
  if (serve) {
    reviewing = true; auth.advance(Date.now() - +auth.now()); clock = auth.now()
    assert.equal((await fetch(base + '/api/qa/enter/organizer', { method: 'POST',
      headers: { 'x-temuevent-client': 'web', origin: 'https://foreign.example.test' } })).status, 403)
    for (const [persona, count] of [['organizer', 2], ['buyer-accept', 1], ['buyer-reject', 1]]) {
      const entered = await fetch(base + '/api/qa/enter/' + persona, { method: 'POST', headers: { 'x-temuevent-client': 'web' } })
      assert.equal(entered.status, 200)
      const privateCookie = entered.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
      const snapshot = await fetch(base + '/api/qa/overview', { headers: { cookie: privateCookie } })
      assert.equal(snapshot.status, 200)
      const own = (await snapshot.json()).data
      assert.equal(own.purchases.length, count)
      assert(own.purchases.every(p => p.status === 'WAITING_FOR_ADMIN_CONFIRMATION'))
      assert.deepEqual(own.capturedMessages, [])
    }
    evidence.reviewBootstrapVerified = true
    evidence.manualReviewReady = true; evidence.disposableDatabaseClosed = false
    if (reportIndex !== -1) {
      const path = resolve(process.argv[reportIndex + 1]); await mkdir(dirname(path), { recursive: true })
      await writeFile(path + '.tmp', JSON.stringify(evidence, null, 2) + '\n'); await rename(path + '.tmp', path)
    }
    reviewTimer = setInterval(() => { void worker.dispatchPending() }, 1000)
    console.log('ROUND5_REVIEW_READY: http://127.0.0.1:4405/qa ; real F2 UI at http://127.0.0.1:3305/organizer ; local fixtures only')
    await new Promise(done => { process.once('SIGINT', done); process.once('SIGTERM', done) })
  }
} finally {
  if (reviewTimer) clearInterval(reviewTimer)
  if (server) await new Promise((done, fail) => server.close(error => error ? fail(error) : done()))
  await db?.$disconnect(); await socket?.stop(); await pg.close()
}
evidence.disposableDatabaseClosed = true
if (reportIndex !== -1) {
  const path = resolve(process.argv[reportIndex + 1])
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path + '.tmp', JSON.stringify(evidence, null, 2) + '\n')
  await rename(path + '.tmp', path)
}
console.log('ROUND5_F2_QA_COMPLETE:', JSON.stringify(evidence))
