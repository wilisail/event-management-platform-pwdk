import assert from 'node:assert/strict'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { readFile, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { PrismaPg } from '@prisma/adapter-pg'

// These TypeScript files are CommonJS in their package. Keep their dependency
// loading on the CJS path so Node 22 does not translate JSON dependencies as ESM.
const require = createRequire(import.meta.url)
const generated = require('../../feature-2/generated/prisma/client.ts')
const application = require('../../feature-2/server/app.ts')
const organizerReads = require('../../feature-2/server/organizer/read-repository.ts')
const attendance = require('../../feature-2/server/organizer/attendance.ts')
const decisionEmails = require('../../feature-2/server/email/organizer-decision.ts')
const outbox = require('../../feature-2/server/email/organizer-decision-repository.ts')
const resend = require('../../feature-2/server/email/resend.ts')
const recovery = require('../../feature-2/server/auth/password-reset.ts')
const resetRepository = require('../../feature-2/server/auth/reset-repository.ts')
const sessions = require('../../feature-2/tests/helpers/sessions.ts')

const pg = await PGlite.create()
let socket, db

async function withApi(options, work) {
  const server = application.createApp({ ...options, secureCookies: false }).listen(0, '127.0.0.1')
  await once(server, 'listening')
  try { await work(`http://127.0.0.1:${server.address().port}/api/organizer/transactions`) }
  finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
}

function headers(login) {
  return { cookie: `temuevent_access=${login.accessToken}; temuevent_refresh=${login.refreshToken}` }
}

function decide(base, purchaseId, login, decision, overrides = {}) {
  return fetch(`${base}/${purchaseId}/decision`, {
    method: 'POST', headers: { ...headers(login), 'content-type': 'application/json',
      'x-temuevent-client': 'web', 'x-csrf-token': login.csrfToken, ...overrides },
    body: JSON.stringify(typeof decision === 'string' ? { decision } : decision),
  })
}

try {
  // No project connection string is read. All fixtures live in this disposable database.
  const migrationsRoot = new URL('../prisma/migrations/', import.meta.url)
  const migrations = (await readdir(migrationsRoot, { withFileTypes: true }))
    .filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
  await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;')
  for (const migration of migrations) await pg.exec(await readFile(new URL(`${migration}/migration.sql`, migrationsRoot), 'utf8'))

  socket = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 0 })
  await socket.start()
  const adapter = new PrismaPg({ connectionString: `postgresql://postgres@${socket.getServerConn()}/postgres`,
    max: 1, connectionTimeoutMillis: 5000, ssl: false })
  db = new generated.PrismaClient({ adapter })
  await db.$executeRaw`SET ROLE temuevent_app`
  const [privileges] = await db.$queryRaw`SELECT current_user AS role,
    has_table_privilege('anon', 'temuevent.organizer_decision_emails', 'SELECT') AS anon_read,
    has_table_privilege('authenticated', 'temuevent.organizer_decision_emails', 'SELECT') AS authenticated_read,
    has_table_privilege('service_role', 'temuevent.organizer_decision_emails', 'SELECT') AS public_service_read,
    has_column_privilege('temuevent_app', 'temuevent.organizer_decision_emails', 'recipient_email', 'UPDATE') AS payload_update`
  assert.deepEqual(privileges, { role: 'temuevent_app', anon_read: false, authenticated_read: false,
    public_service_read: false, payload_update: false })

  const auth = sessions.sessionFixture()
  const buyer = sessions.testAccount
  const owner = { ...buyer, id: '22222222-2222-4222-8222-222222222222', email: 'own@example.test', role: 'ORGANIZER', referralCode: 'ORGANIZER01' }
  const other = { ...owner, id: '33333333-3333-4333-8333-333333333333', email: 'other@example.test', referralCode: 'ORGANIZER02' }
  auth.users.set(owner.email, owner)
  auth.users.set(other.email, other)
  const [ownerLogin, otherLogin, buyerLogin] = await Promise.all([owner, other, buyer]
    .map(user => auth.service.login({ ...sessions.loginFields, email: user.email })))
  await db.user.createMany({ data: [owner, other, buyer].map(({ id, email, name, role, referralCode }) =>
    ({ id, email, name, role, referralCode })) })

  const eventDates = { startAt: auth.now(), endAt: new Date(+auth.now() + 86400000) }
  const event = await db.event.create({ data: { ...eventDates, organizerId: owner.id,
    slug: 'day4-owned', name: 'Owned event', category: 'Test', location: 'Jakarta' } })
  const otherEvent = await db.event.create({ data: { ...eventDates, organizerId: other.id,
    slug: 'day4-other', name: 'Other event', category: 'Test', location: 'Jakarta' } })
  const ticket = await db.ticketType.create({ data: { eventId: event.id, name: 'Regular', price: 125000n, quota: 10, availableSeats: 8 } })
  const privateKey = 'isolated-private-proof-key'
  const makePurchase = (reference, status, eventId = event.id, decisionDueAt = new Date(+auth.now() + 120000)) =>
    db.purchase.create({ data: { reference, status, eventId, customerId: buyer.id, subtotal: 125000n,
      voucherDiscount: 5000n, couponDiscount: 10000n, pointsUsed: 2000n, totalPrice: 108000n,
      ...(status === 'WAITING_FOR_PAYMENT' && { paymentDueAt: new Date(+auth.now() + 120000) }),
      ...(status === 'WAITING_FOR_ADMIN_CONFIRMATION' && { proofUploadedAt: auth.now(), decisionDueAt, paymentProofKey: privateKey }),
      ...(status === 'DONE' && { completedAt: auth.now() }),
    } })
  const approval = await makePurchase('day4-accept<&>', 'WAITING_FOR_ADMIN_CONFIRMATION')
  const rejection = await makePurchase('day4-reject', 'WAITING_FOR_ADMIN_CONFIRMATION')
  const timed = await makePurchase('day4-exact-deadline', 'WAITING_FOR_ADMIN_CONFIRMATION', event.id, auth.now())
  const raced = await makePurchase('day4-race', 'WAITING_FOR_ADMIN_CONFIRMATION', event.id, new Date(+auth.now() + 1000))
  const rollback = await makePurchase('day4-rollback', 'WAITING_FOR_ADMIN_CONFIRMATION')
  const lease = await makePurchase('day4-lease', 'DONE')
  await makePurchase('day4-unpaid', 'WAITING_FOR_PAYMENT')
  await makePurchase('day4-rejected', 'REJECTED')
  await makePurchase('day4-expired', 'EXPIRED')
  await makePurchase('day4-canceled', 'CANCELED')
  const foreign = await makePurchase('day4-foreign', 'WAITING_FOR_ADMIN_CONFIRMATION', otherEvent.id)
  await db.purchaseItem.create({ data: { purchaseId: approval.id, eventId: event.id, ticketTypeId: ticket.id,
    quantity: 1, unitPrice: 125000n, lineTotal: 125000n } })

  const organizerRepository = organizerReads.prismaOrganizerReadRepository(db)
  const options = { organizerRepository, sessionService: auth.service, now: auth.now }
  await withApi(options, async base => {
    assert.equal((await fetch(base)).status, 401)
    assert.equal((await fetch(base, { headers: headers(buyerLogin) })).status, 403)
    const list = await fetch(`${base}?pageSize=50`, { headers: headers(ownerLogin) })
    assert.equal(list.status, 200)
    assert.match(list.headers.get('cache-control'), /no-store/)
    const { data } = await list.json()
    assert.equal(data.pagination.total, 10)
    assert.equal(new Set(data.items.map(item => item.status)).size, 6)
    assert(data.items.every(item => item.id !== foreign.id))
    const filtered = await (await fetch(`${base}?status=DONE`, { headers: headers(ownerLogin) })).json()
    assert.deepEqual(filtered.data.items.map(item => item.id), [lease.id])
    assert.equal((await fetch(`${base}?organizerId=${other.id}`, { headers: headers(ownerLogin) })).status, 400)
    const detail = await (await fetch(`${base}/${approval.id}`, { headers: headers(ownerLogin) })).json()
    assert.equal(detail.data.decisionAvailability, 'UNAVAILABLE')
    assert.equal(detail.data.totalPrice, 108000)
    assert.equal(detail.data.items[0].ticketName, 'Regular')
    assert.equal(detail.data.proofUploadedAt, approval.proofUploadedAt.toISOString())
    assert(!JSON.stringify(detail).includes(privateKey) && !JSON.stringify(detail).includes(buyer.email))
    assert.equal((await fetch(`${base}/${approval.id}`, { headers: headers(otherLogin) })).status, 404)
    assert.equal((await decide(base, approval.id, ownerLogin, 'ACCEPT')).status, 503)
    assert.equal((await decide(base, timed.id, ownerLogin, 'ACCEPT')).status, 409)
    assert.equal(await db.organizerDecisionEmail.count(), 0)
  })

  // Test adapter deliberately covers purchase status + outbox only. F1's engine and stock/reward effects are separate.
  let transitionCalls = 0
  const organizerDecisionTransition = ({ organizerId, transactionId, decision }) => db.$transaction(async tx => {
    transitionCalls++
    if (transactionId === raced.id) auth.advance(1000)
    const applied = await tx.purchase.updateMany({ where: { id: transactionId, event: { organizerId },
      status: 'WAITING_FOR_ADMIN_CONFIRMATION', decisionDueAt: { gt: auth.now() } },
    data: { status: decision === 'ACCEPT' ? 'DONE' : 'REJECTED', completedAt: decision === 'ACCEPT' ? auth.now() : null } })
    if (!applied.count) return 'CLOSED'
    await outbox.enqueueOrganizerDecisionEmail(tx, transactionId, decision)
    return 'APPLIED'
  })
  await withApi({ ...options, organizerDecisionTransition }, async base => {
    assert.equal((await decide(base, approval.id, buyerLogin, 'ACCEPT')).status, 403)
    assert.equal((await decide(base, approval.id, ownerLogin, 'ACCEPT', { 'x-csrf-token': otherLogin.csrfToken })).status, 403)
    assert.equal((await decide(base, approval.id, otherLogin, 'ACCEPT')).status, 404)
    assert.equal((await decide(base, approval.id, ownerLogin, { decision: 'ACCEPT', organizerId: other.id })).status, 400)
    assert.equal((await decide(base, timed.id, ownerLogin, 'ACCEPT')).status, 409)
    assert.equal(transitionCalls, 0)
    assert.equal((await decide(base, raced.id, ownerLogin, 'ACCEPT')).status, 409)
    const accepted = await decide(base, approval.id, ownerLogin, 'ACCEPT')
    assert.equal(accepted.status, 200)
    assert.deepEqual((await accepted.json()).data, { id: approval.id, status: 'DONE' })
    assert.equal((await decide(base, approval.id, ownerLogin, 'ACCEPT')).status, 409)
    const rejected = await decide(base, rejection.id, ownerLogin, 'REJECT')
    assert.equal(rejected.status, 200)
    assert.deepEqual((await rejected.json()).data, { id: rejection.id, status: 'REJECTED' })
    assert.equal(transitionCalls, 3)
  })
  assert.equal(await db.organizerDecisionEmail.count(), 2)
  await assert.rejects(db.$transaction(async tx => {
    await tx.purchase.update({ where: { id: rollback.id }, data: { status: 'REJECTED' } })
    await outbox.enqueueOrganizerDecisionEmail(tx, rollback.id, 'REJECT')
    throw new Error('isolated rollback')
  }), /isolated rollback/)
  assert.equal((await db.purchase.findUniqueOrThrow({ where: { id: rollback.id } })).status, 'WAITING_FOR_ADMIN_CONFIRMATION')
  assert.equal(await db.organizerDecisionEmail.count(), 2)
  await assert.rejects(outbox.enqueueOrganizerDecisionEmail(db, lease.id, 'ACCEPT'), /requires a matching purchase/)
  await db.$transaction(tx => outbox.enqueueOrganizerDecisionEmail(tx, approval.id, 'ACCEPT'))
  assert.equal(await db.organizerDecisionEmail.count(), 2)

  const repository = outbox.prismaDecisionEmailRepository(db)
  const requests = []
  const fakeMailer = resend.resendMailer({ RESET_API_KEY: 'test-only-key', F2_EMAIL_FROM: 'temu@example.test' }, async (_url, init) => {
    const key = new Headers(init.headers).get('Idempotency-Key')
    const previousAttempts = requests.filter(request => request.key === key).length
    const body = JSON.parse(init.body)
    requests.push({ key, body })
    if (body.text.includes('day4-rollback')) return new Response(null, { status: 429 })
    if (body.subject.includes('ditolak')) return new Response(null, { status: 403 })
    if (!previousAttempts) return new Response(null, { status: 429 })
    return Response.json({ id: 'isolated-provider-acceptance' })
  })
  const worker = decisionEmails.createDecisionEmailWorker(repository, fakeMailer)
  await worker.dispatchPending()
  const getJob = purchaseId => db.organizerDecisionEmail.findUniqueOrThrow({ where: { purchaseId } })
  assert.equal((await getJob(approval.id)).deliveryState, 'RETRY')
  assert.equal((await getJob(rejection.id)).deliveryState, 'FAILED')
  await db.organizerDecisionEmail.update({ where: { purchaseId: approval.id }, data: { nextAttemptAt: new Date(0) } })
  await worker.dispatchPending()
  const acceptedJob = await getJob(approval.id)
  assert.equal(acceptedJob.deliveryState, 'ACCEPTED')
  assert.equal(acceptedJob.attemptCount, 2)
  const retries = requests.filter(request => request.key === `organizer-decision/${acceptedJob.id}`)
  assert.equal(retries.length, 2)
  assert.deepEqual(retries[0], retries[1])
  assert.match(retries[0].body.html, /day4-accept&lt;&amp;&gt;/)

  await db.$transaction(tx => outbox.enqueueOrganizerDecisionEmail(tx, lease.id, 'ACCEPT'))
  const abandoned = await repository.claim()
  assert(abandoned)
  assert.equal(await repository.claim(), null)
  await db.organizerDecisionEmail.update({ where: { id: abandoned.id }, data: { leasedUntil: new Date(0) } })
  const replacement = await repository.claim()
  assert(replacement)
  assert.notEqual(replacement.leaseId, abandoned.leaseId)
  await repository.finish(abandoned, 'FAILED')
  assert.equal((await getJob(lease.id)).leaseId, replacement.leaseId)
  await repository.finish(replacement, 'ACCEPTED')
  assert.equal((await getJob(lease.id)).deliveryState, 'ACCEPTED')

  await db.$transaction(async tx => {
    await tx.purchase.update({ where: { id: rollback.id }, data: { status: 'DONE', completedAt: auth.now() } })
    await outbox.enqueueOrganizerDecisionEmail(tx, rollback.id, 'ACCEPT')
  })
  for (const attempt of [1, 2, 3]) {
    await worker.dispatchPending()
    const job = await getJob(rollback.id)
    assert.equal(job.attemptCount, attempt)
    assert.equal(job.deliveryState, attempt === 3 ? 'FAILED' : 'RETRY')
    if (attempt < 3) await db.organizerDecisionEmail.update({ where: { id: job.id }, data: { nextAttemptAt: new Date(0) } })
  }
  await worker.dispatchPending()
  assert.equal((await getJob(rollback.id)).attemptCount, 3)
  console.log(`DAY4_ISOLATED_OK: ${migrations.length} migrations; restricted-role HTTP, rollback, retries and lease fencing`)

  const scheduledPurchase = await makePurchase('day6-scheduled', 'DONE')
  await db.$transaction(tx => outbox.enqueueOrganizerDecisionEmail(tx, scheduledPurchase.id, 'ACCEPT'))
  await db.user.update({ where: { id: buyer.id }, data: { passwordHash: 'isolated-fixture-hash' } })
  const reset = recovery.createPasswordResetService({
    repository: resetRepository.prismaResetRepository(db, work => db.$transaction(work)),
    mailer: fakeMailer, origin: 'https://preview.example.test', signingSecret: 'test-only-secret-'.repeat(3),
  })
  await reset.request({ email: buyer.email })
  const secret = 'ac'.repeat(32)
  await withApi({ ...options, scheduledEmailJobs: { secret, passwordReset: reset.dispatchPending,
    decisionEmails: worker.dispatchPending } }, async base => {
    const origin = new URL(base).origin
    const tick = async () => {
      const result = await fetch(origin + '/api/internal/jobs/run', {
        method: 'POST', headers: { Authorization: 'Bearer ' + secret },
      })
      assert.equal(result.status, 200)
      assert.equal((await result.json()).decisionEmails, true)
    }
    // A timer client wakes the worker without a browser or the in-process server poller.
    await delay(20)
    await tick()
    const afterFirst = await db.passwordResetToken.findFirstOrThrow({ where: { recipientEmail: buyer.email } })
    assert.equal(afterFirst.deliveryState, 'RETRY')
    assert.equal((await getJob(scheduledPurchase.id)).deliveryState, 'RETRY')
    await db.passwordResetToken.update({ where: { id: afterFirst.id }, data: { nextAttemptAt: new Date(0) } })
    await db.organizerDecisionEmail.update({ where: { purchaseId: scheduledPurchase.id }, data: { nextAttemptAt: new Date(0) } })
    await delay(20)
    await tick()
    const resetDone = await db.passwordResetToken.findUniqueOrThrow({ where: { id: afterFirst.id } })
    assert.equal(resetDone.deliveryState, 'ACCEPTED')
    assert.equal(resetDone.attemptCount, 2)
    const resetAttempts = requests.filter(request => request.key === `password-reset/${resetDone.id}`)
    assert.equal(resetAttempts.length, 2)
    assert.deepEqual(resetAttempts[0], resetAttempts[1])
    assert.equal((await getJob(scheduledPurchase.id)).deliveryState, 'ACCEPTED')
  })
  console.log('DAY62_SCHEDULED_EMAIL_OK: timer-driven HTTP, reset and decision retry, persisted acceptance')

  // Day 5.1 reuses the same database and roles, with cases on a Jakarta midnight boundary.
  auth.advance(3 * 86400000)
  const [statsOwner, statsOther, statsBuyer] = await Promise.all([owner, other, buyer]
    .map(user => auth.service.login({ ...sessions.loginFields, email: user.email })))
  const secondTicket = await db.ticketType.create({ data: { eventId: event.id, name: 'Early', price: 25000n, quota: 10, availableSeats: 8 } })
  const completedAt = new Date('2026-10-31T17:00:00.000Z') // 1 November, 00:00 WIB
  const reportPurchase = async (reference, status, eventId, at, price) => {
    // The disposable server can inherit a non-UTC session timezone. Seed exact instants with an explicit offset.
    const [purchase] = await db.$queryRaw`
      INSERT INTO temuevent.purchases (reference, status, event_id, customer_id, subtotal, total_price, completed_at)
      VALUES (${reference}, ${status}::temuevent."PurchaseStatus", ${eventId}::uuid, ${buyer.id}::uuid,
        ${price}, ${price}, ${at.toISOString()}::timestamptz)
      RETURNING id`
    return purchase
  }
  await reportPurchase('stats-before-wib-midnight', 'DONE', event.id, new Date(+completedAt - 1), 25000n)
  const reportPaid = await reportPurchase('stats-paid', 'DONE', event.id, completedAt, 125000n)
  const reportFree = await reportPurchase('stats-free', 'DONE', event.id, new Date('2026-11-02T01:00:00Z'), 0n)
  await reportPurchase('stats-rejected', 'REJECTED', event.id, completedAt, 50000n)
  await reportPurchase('stats-foreign', 'DONE', otherEvent.id, completedAt, 99000n)
  await db.purchaseItem.createMany({ data: [
    { purchaseId: reportPaid.id, eventId: event.id, ticketTypeId: ticket.id, quantity: 1, unitPrice: 75000n, lineTotal: 75000n },
    { purchaseId: reportPaid.id, eventId: event.id, ticketTypeId: secondTicket.id, quantity: 2, unitPrice: 25000n, lineTotal: 50000n },
    { purchaseId: reportFree.id, eventId: event.id, ticketTypeId: ticket.id, quantity: 1, unitPrice: 0n, lineTotal: 0n },
  ] })
  await withApi(options, async base => {
    const url = base.replace(/transactions$/, 'statistics')
    const get = (query, login = statsOwner) => fetch(url + query, { headers: headers(login) })
    assert.equal((await fetch(url)).status, 401)
    assert.equal((await get('', statsBuyer)).status, 403)
    for (const invalid of ['?groupBy=week', '?from=2026-11-01', '?from=2026-02-30&to=2026-03-01',
      '?from=2026-11-03&to=2026-11-01', '?from=2026-01-01&to=2026-11-03', '?from=2026-11-03&to=2026-11-04',
      `?organizerId=${other.id}`]) assert.equal((await get(invalid)).status, 400)
    const range = '&from=2026-11-01&to=2026-11-03'
    for (const [group, periods, defaults] of [['day', 3, 14], ['month', 1, 12], ['year', 1, 5]]) {
      const reply = await get('?groupBy=' + group + range)
      assert.equal(reply.status, 200)
      assert.match(reply.headers.get('cache-control'), /no-store/)
      const { data } = await reply.json()
      assert.equal(data.timeZone, 'Asia/Jakarta')
      assert.equal(data.periods.length, periods)
      assert.deepEqual(data.totals, { revenueIdr: 125000, purchaseCount: 2, ticketQuantity: 4 })
      if (group === 'day') assert.deepEqual(data.periods, [
        { startDate: '2026-11-01', revenueIdr: 125000, purchaseCount: 1, ticketQuantity: 3 },
        { startDate: '2026-11-02', revenueIdr: 0, purchaseCount: 1, ticketQuantity: 1 },
        { startDate: '2026-11-03', revenueIdr: 0, purchaseCount: 0, ticketQuantity: 0 },
      ])
      const fallback = await (await get('?groupBy=' + group)).json()
      assert.equal(fallback.data.periods.length, defaults)
      assert.equal(fallback.data.to, '2026-11-03')
    }
    const foreignReport = await (await get('?groupBy=day' + range, statsOther)).json()
    assert.deepEqual(foreignReport.data.totals, { revenueIdr: 99000, purchaseCount: 1, ticketQuantity: 0 })
  })
  console.log('DAY51_STATISTICS_OK: owned totals, Jakarta midnight, zero/free periods and all three groupings')

  // Day 5.2 reuses a paid and a free confirmed purchase for the same customer/event.
  const [attendanceGrants] = await db.$queryRaw`SELECT
    has_table_privilege('anon', 'temuevent.attendance', 'SELECT') AS anon_read,
    has_table_privilege('authenticated', 'temuevent.attendance', 'INSERT') AS public_write,
    has_table_privilege('temuevent_app', 'temuevent.attendance', 'UPDATE') AS backend_edit`
  assert.deepEqual(attendanceGrants, { anon_read: false, public_write: false, backend_edit: false })
  assert.equal(await attendance.hasAttendedEvent(db, event.id, buyer.id), false)
  await withApi(options, async base => {
    const eventApi = base.replace(/transactions$/, `events/${event.id}`)
    const mark = (transactionId, login = statsOwner, overrides = {}, customerId = buyer.id) => fetch(eventApi + '/attendance', {
      method: 'POST', headers: { ...headers(login), 'content-type': 'application/json',
        'x-temuevent-client': 'web', 'x-csrf-token': login.csrfToken, ...overrides },
      body: JSON.stringify({ customerId, transactionId }),
    })
    const list = async () => (await (await fetch(eventApi + '/attendees?pageSize=50', { headers: headers(statsOwner) })).json()).data.items
    assert((await list()).every(row => row.attendedAt === null))
    assert.equal((await mark(reportPaid.id, statsBuyer)).status, 403)
    assert.equal((await mark(reportPaid.id, statsOwner, { 'x-csrf-token': statsOther.csrfToken })).status, 403)
    assert.equal((await mark(reportPaid.id, statsOther)).status, 404)
    assert.equal((await mark(reportPaid.id, statsOwner, {}, other.id)).status, 404)
    assert.equal((await mark(raced.id)).status, 404)
    assert.equal(await db.attendance.count(), 0)
    const first = await mark(reportFree.id)
    assert.equal(first.status, 200)
    const recorded = (await first.json()).data
    assert.equal(recorded.transactionId, reportFree.id)
    assert.equal(recorded.customerId, buyer.id)
    assert(Number.isFinite(Date.parse(recorded.attendedAt)))
    const repeated = await mark(reportPaid.id)
    assert.equal(repeated.status, 200)
    assert.deepEqual((await repeated.json()).data, recorded)
    assert.equal(await db.attendance.count(), 1)
    const reload = await list()
    assert(reload.length > 1 && reload.every(row => row.attendedAt === recorded.attendedAt))
  })
  assert.equal(await attendance.hasAttendedEvent(db, event.id, buyer.id), true)
  assert.equal(await attendance.hasAttendedEvent(db, otherEvent.id, buyer.id), false)
  assert.equal(await attendance.hasAttendedEvent(db, event.id, other.id), false)
  // Assert the actual FK error directly. The disposable socket wrapper can close a connection on a SQL error.
  await db.$disconnect()
  db = undefined
  await socket.stop()
  socket = undefined
  await pg.exec('SET ROLE temuevent_app')
  await assert.rejects(pg.query(`INSERT INTO temuevent.attendance(event_id, customer_id, transaction_id, marked_by_organizer_id)
    VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid)`, [event.id, other.id, reportPaid.id, owner.id]), { code: '23503' })
  assert.equal((await pg.query('SELECT count(*)::int AS count FROM temuevent.attendance')).rows[0].count, 1)
  console.log('DAY52_ATTENDANCE_OK: owner/CSRF guards, free confirmation, stable repeat and review eligibility')
} finally {
  await db?.$disconnect()
  await socket?.stop()
  await pg.close()
}
