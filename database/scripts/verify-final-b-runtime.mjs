import assert from 'node:assert/strict'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { PrismaPg } from '@prisma/adapter-pg'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('../../feature-2/generated/prisma/client.ts')
const { createRuntime } = require('../../feature-2/server/runtime.ts')
const { hashPassword } = require('../../feature-2/server/auth/passwords.ts')
const { customerRewards } = require('../../feature-2/server/rewards/operations.ts')
const { rewardFixture, testCheckout } = require('../../feature-2/scripts/helpers/reward-fixtures.ts')
const { MailDeliveryError } = require('../../feature-2/server/email/resend.ts')
const args = process.argv.slice(2)
if (args.length && (args.length !== 2 || args[0] !== '--report' || args[1].startsWith('--'))) throw new Error('Usage: verify-final-b-runtime.mjs [--report PATH]')
const report = { checkedAt: new Date().toISOString(), scope: 'FINAL_B_REAL_RUNTIME_ISOLATED', liveDatabaseUsed: false,
  externalEmailSent: false, qaTransitionAdapterUsed: false, ownerBrowserAccepted: false, scenarios: [],
  concurrencyLimit: 'Concurrent HTTP requests share one disposable physical SQL connection; independent-session races are not claimed.' }
const passed = name => { report.scenarios.push(name); console.log('FINAL_B_OK:', name) }
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
const pg = await PGlite.create()
let socket, db, server
try {
  await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;')
  const root = new URL('../prisma/migrations/', import.meta.url)
  const names = (await readdir(root, { withFileTypes: true })).filter(x => x.isDirectory()).map(x => x.name).sort()
  for (const name of names) await pg.exec(await readFile(new URL(name + '/migration.sql', root), 'utf8'))
  socket = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 0 }); await socket.start()
  db = new PrismaClient({ adapter: new PrismaPg({ connectionString: `postgresql://postgres@${socket.getServerConn()}/postgres`, max: 1, ssl: false }) })
  await db.$executeRaw`SET ROLE temuevent_app`
  await db.$executeRaw`SET TIME ZONE 'UTC'`
  const [{ at }] = await db.$queryRaw`SELECT clock_timestamp() AS at`
  const files = new Map(), messages = [], password = 'disposable runtime verification password'
  const passwordHash = await hashPassword(password)
  async function fixture(tag, { proof = true, voucher = 0 } = {}) {
    const f = await db.$transaction(tx => rewardFixture(tx, at, 'final-b-' + tag + '-' + randomUUID()))
    const { purchaseId } = await db.$transaction(async tx => testCheckout(tx, f,
      await customerRewards(tx, f.owner.id), { pointsRequested: 5000, couponId: f.coupon.id, voucherDiscount: voucher }))
    if (proof) {
      const key = 'purchases/' + purchaseId + '/proof.png'
      files.set(key, { bytes: png, contentType: 'image/png' })
      await db.purchase.update({ where: { id: purchaseId }, data: { status: 'WAITING_FOR_ADMIN_CONFIRMATION',
        paymentProofKey: key, proofUploadedAt: at, decisionDueAt: new Date(+at + 3 * 86400000) } })
    }
    await db.user.updateMany({ where: { id: { in: [f.owner.id, f.organizer.id] } }, data: { passwordHash } })
    return { ...f, purchaseId }
  }
  const accept = await fixture('accept'), reject = await fixture('reject'), rollback = await fixture('rollback')
  const expire = await fixture('expire', { proof: false }), cancel = await fixture('cancel')
  const race = await fixture('race'), voucher = await fixture('voucher', { voucher: 1000 })
  const inventory = await fixture('inventory'), legacy = await fixture('legacy', { proof: false })
  let failMail = true
  const runtime = await createRuntime({ client: db, paymentProofStorage: { read: async key => files.get(key) ?? null },
    mailer: { send: async message => { if (failMail) throw new MailDeliveryError(503); messages.push(message) } },
    env: { AUTH_JWT_SECRET: 'ab'.repeat(32), F2_JOB_RUNNER_SECRET: 'cd'.repeat(32),
      F2_PASSWORD_RESET_ORIGIN: 'http://localhost:3001', F2_DECISION_EMAIL_WORKER_ENABLED: 'true',
      F2_PURCHASE_DEADLINE_START_AT: new Date(+at - 3600000).toISOString() } })
  server = runtime.app.listen(0, '127.0.0.1'); await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  const login = user => runtime.sessionService.login({ email: user.email, password })
  const cookie = session => `temuevent_access=${session.accessToken}; temuevent_refresh=${session.refreshToken}`
  const get = (path, session) => fetch(base + path, { headers: session ? { cookie: cookie(session) } : {} })
  const decide = (f, session, decision = 'ACCEPT') => fetch(`${base}/api/organizer/transactions/${f.purchaseId}/decision`, {
    method: 'POST', headers: { cookie: cookie(session), 'x-csrf-token': session.csrfToken,
      'x-temuevent-client': 'web', 'content-type': 'application/json' }, body: JSON.stringify({ decision }) })
  const worker = () => fetch(base + '/api/internal/jobs/run', { method: 'POST', headers: { Authorization: 'Bearer ' + 'cd'.repeat(32) } })
  const state = id => db.purchase.findUniqueOrThrow({ where: { id }, include: { rewardRedemption: true, decisionEmail: true } })
  const a = await login(accept.organizer), r = await login(reject.organizer), buyer = await login(accept.owner)

  const health = (await (await get('/api/health')).json()).data
  assert(health.privateProofsConfigured && health.organizerDecisionsConfigured && health.purchaseDeadlinesConfigured)
  assert.equal((await get('/api/ready')).status, 200)
  assert.equal((await get('/qa')).status, 404)
  passed('Normal runtime binds proof, decisions and deadlines without a QA transition adapter')

  const path = '/api/organizer/transactions/' + accept.purchaseId
  assert.equal((await get(path + '/proof')).status, 401)
  assert.equal((await get(path + '/proof', buyer)).status, 403)
  assert.equal((await get(path + '/proof', r)).status, 404)
  const proof = await get(path + '/proof', a)
  assert.equal(proof.status, 200); assert.equal(proof.headers.get('cache-control'), 'private, no-store')
  assert.deepEqual(Buffer.from(await proof.arrayBuffer()), png)
  const detail = await (await get(path, a)).json()
  assert.equal(detail.data.decisionAvailability, 'READY'); assert.equal(detail.data.proofAvailability, 'READY')
  assert(!JSON.stringify(detail).includes('/proof.png'))
  assert.equal(await runtime.purchaseTransitions.decide({ organizerId: reject.organizer.id, transactionId: accept.purchaseId, decision: 'ACCEPT' }), 'NOT_FOUND')
  passed('Real sessions and repeat ownership protect private proof bytes and decision identity')

  assert.equal((await decide(accept, a)).status, 200)
  assert.equal((await decide(accept, a)).status, 409)
  const approved = await state(accept.purchaseId)
  assert.equal(approved.status, 'DONE'); assert.equal(approved.rewardRedemption.status, 'CONSUMED')
  assert.equal(approved.decisionEmail.deliveryState, 'PENDING')
  assert.equal((await db.ticketType.findUniqueOrThrow({ where: { id: accept.ticket.id } })).availableSeats, 99)
  passed('Approval persists DONE, consumes reserved rewards and atomically queues one notification')

  assert.equal((await decide(reject, r, 'REJECT')).status, 200)
  assert.equal((await decide(reject, r, 'REJECT')).status, 409)
  assert.equal((await state(reject.purchaseId)).rewardRedemption.status, 'RESTORED')
  assert.equal((await db.pointGrant.findUniqueOrThrow({ where: { id: reject.grants[0].id } })).remainingAmount, 10000n)
  assert.equal((await db.ticketType.findUniqueOrThrow({ where: { id: reject.ticket.id } })).availableSeats, 100)
  passed('Rejection restores original points, coupon availability and seats once')

  const failedMail = await worker(); assert.equal(failedMail.status, 200)
  assert.equal((await state(accept.purchaseId)).status, 'DONE')
  assert.equal((await state(accept.purchaseId)).decisionEmail.deliveryState, 'RETRY')
  failMail = false
  await db.$executeRaw`UPDATE temuevent.organizer_decision_emails SET next_attempt_at = clock_timestamp() - interval '1 second' WHERE delivery_state = 'RETRY'`
  const delivered = await worker(); assert.equal(delivered.status, 200)
  assert.equal((await delivered.json()).purchaseDeadlines, true)
  assert.equal((await state(accept.purchaseId)).decisionEmail.deliveryState, 'ACCEPTED')
  assert.equal(messages.length, 2)
  passed('The existing authorized scheduler retries captured mail without undoing committed decisions')

  await db.purchase.update({ where: { id: expire.purchaseId }, data: { paymentDueAt: new Date(+at - 1) } })
  await db.purchase.update({ where: { id: cancel.purchaseId }, data: { decisionDueAt: new Date(+at - 1) } })
  await db.purchase.update({ where: { id: legacy.purchaseId }, data: { createdAt: new Date(+at - 7200000), paymentDueAt: new Date(+at - 1) } })
  assert.equal(await runtime.purchaseTransitions.decide({ organizerId: cancel.organizer.id, transactionId: cancel.purchaseId, decision: 'ACCEPT' }), 'CLOSED')
  assert.equal((await worker()).status, 200); assert.equal((await worker()).status, 200)
  for (const [f, status] of [[expire, 'EXPIRED'], [cancel, 'CANCELED']]) {
    assert.equal((await state(f.purchaseId)).status, status)
    assert.equal((await state(f.purchaseId)).rewardRedemption.status, 'RESTORED')
    assert.equal((await db.ticketType.findUniqueOrThrow({ where: { id: f.ticket.id } })).availableSeats, 100)
  }
  assert.equal((await state(legacy.purchaseId)).status, 'WAITING_FOR_PAYMENT')
  passed('Database-clock deadlines restore once, reject late approval and preserve the configured historical cohort')

  await pg.exec(`RESET ROLE; CREATE FUNCTION temuevent.final_b_outbox_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.purchase_id = '${rollback.purchaseId}'::uuid THEN RAISE EXCEPTION 'disposable outbox failure'; END IF;
    RETURN NEW; END $$;
    CREATE TRIGGER final_b_outbox_failure BEFORE INSERT ON temuevent.organizer_decision_emails
    FOR EACH ROW EXECUTE FUNCTION temuevent.final_b_outbox_failure(); SET ROLE temuevent_app;`)
  const rb = await login(rollback.organizer)
  assert.equal((await decide(rollback, rb)).status, 503)
  assert.equal((await state(rollback.purchaseId)).status, 'WAITING_FOR_ADMIN_CONFIRMATION')
  assert.equal((await state(rollback.purchaseId)).rewardRedemption.status, 'RESERVED')
  assert.equal((await state(rollback.purchaseId)).decisionEmail, null)
  await pg.exec('RESET ROLE; DROP TRIGGER final_b_outbox_failure ON temuevent.organizer_decision_emails; DROP FUNCTION temuevent.final_b_outbox_failure(); SET ROLE temuevent_app;')
  assert.equal((await decide(rollback, rb)).status, 200)
  passed('An actual SQL outbox failure rolls the entire decision back; retry commits consistently')

  const rc = await login(race.organizer)
  const outcomes = await Promise.all([decide(race, rc), decide(race, rc, 'REJECT')])
  assert.deepEqual(outcomes.map(x => x.status).sort(), [200, 409])
  assert.equal(await db.organizerDecisionEmail.count({ where: { purchaseId: race.purchaseId } }), 1)
  passed('Competing decisions produce one terminal result and one outbox row')

  const v = await login(voucher.organizer)
  assert.equal((await decide(voucher, v, 'REJECT')).status, 503)
  assert.equal((await state(voucher.purchaseId)).rewardRedemption.status, 'RESERVED')
  const inv = await login(inventory.organizer)
  await db.ticketType.update({ where: { id: inventory.ticket.id }, data: { availableSeats: 100 } })
  assert.equal((await decide(inventory, inv, 'REJECT')).status, 503)
  assert.equal((await state(inventory.purchaseId)).status, 'WAITING_FOR_ADMIN_CONFIRMATION')
  assert.equal((await state(inventory.purchaseId)).rewardRedemption.status, 'RESERVED')
  passed('Unsupported F1 event vouchers and inconsistent inventory fail without partial accounting')

  report.migrationsReplayed = names.length
  if (args.length) { const path = resolve(args[1]); await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(report, null, 2) + '\n') }
  console.log('FINAL_B_RUNTIME_ALL_OK:', report.scenarios.length, 'groups; disposable database; no external mail')
} finally {
  await new Promise(resolve => { if (server?.listening) server.close(() => resolve()); else resolve() })
  await db?.$disconnect().catch(() => {})
  await socket?.stop().catch(() => {})
  await pg.close()
}
