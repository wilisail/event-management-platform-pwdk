import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type Prisma } from '../generated/prisma/client'
import { prismaResetRepository } from '../server/auth/reset-repository'
import { createPasswordResetService } from '../server/auth/password-reset'
import { prismaPasswordRepository } from '../server/auth/password-repository'
import { createPasswordChangeService } from '../server/auth/change-password'
import { prismaSessionRepository } from '../server/auth/session-repository'
import { createSessionService } from '../server/auth/sessions'
import { createSessionTokens } from '../server/auth/session-tokens'
import { hashPassword, verifyPassword } from '../server/auth/passwords'
import type { EmailMessage } from '../server/email/resend'

const value = process.env.PASSWORD_RACE_DATABASE_URL
if (process.env.PASSWORD_RACE_TEST_ALLOW_LOCAL !== 'true' || !value) throw new Error('Explicit isolated race database required')
const url = new URL(value)
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.pathname !== '/temuevent_password_test' || url.username !== 'temuevent_app')
  throw new Error('Reset races only run on the dedicated loopback temuevent_password_test database')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: value, max: 6, ssl: false }) })
const txOptions = { timeout: 30000, maxWait: 10000, isolationLevel: 'ReadCommitted' as const }
type Transaction = <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>
const transaction: Transaction = work => db.$transaction(work, txOptions)
const secret = randomBytes(32).toString('hex'), sessionTokens = createSessionTokens(secret)
const sessions = createSessionService({ repository: prismaSessionRepository(db, transaction), tokens: sessionTokens })
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
async function bounded<T>(promise: Promise<T>) {
  let timer: ReturnType<typeof setTimeout>
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Race barrier timed out')), 10000) })]) }
  finally { clearTimeout(timer!) }
}
function contender(hold = false) {
  const entered = deferred<number>(), release = deferred<void>(), finished = deferred<void>()
  const run: Transaction = work => db.$transaction(async tx => {
    const pid = (await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`)[0].pid
    entered.resolve(pid)
    const result = await work(tx); finished.resolve(); if (hold) await bounded(release.promise)
    return result
  }, txOptions)
  return { run, entered, release, finished }
}
async function blocked(pid: number) {
  for (let i = 0; i < 100; i++) {
    const rows = await db.$queryRaw<{ wait: string | null }[]>`SELECT wait_event_type AS wait FROM pg_stat_activity WHERE pid=${pid}`
    if (rows[0]?.wait === 'Lock') return
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  assert.fail('Expected a real PostgreSQL lock wait')
}
async function fixture() {
  const password = randomBytes(24).toString('hex'), next = randomBytes(24).toString('hex')
  const user = await db.user.create({ data: { email: 'reset-race-' + randomUUID() + '@example.test', name: 'Reset Race QA',
    passwordHash: await hashPassword(password), referralCode: randomBytes(6).toString('hex').toUpperCase() } })
  const credentials = await sessions.login({ email: user.email, password }), actor = await sessions.readSession(credentials.accessToken)
  let offset = 0
  const now = () => new Date(Date.now() + offset), advance = (ms: number) => { offset += ms }
  const mail: EmailMessage[] = []
  const repo = (tx = transaction) => prismaResetRepository(db, tx, now)
  const reset = (tx = transaction) => createPasswordResetService({ repository: repo(tx), mailer: { async send(message) { mail.push(message) } },
    origin: 'https://temuevent.example', signingSecret: secret, now })
  const service = reset(); await service.request({ email: user.email }); await service.dispatchPending()
  const token = mail.at(-1)!.text.match(/#token=([A-Za-z0-9_-]{43})/)![1]
  return { user, password, next, credentials, actor: { userId: user.id, sessionId: actor.id }, now, advance, mail, repo, reset, token }
}
let stage = 'database guard', passed = 0
async function main() {
  assert.deepEqual(await db.$queryRaw`SELECT current_database() AS database, current_user AS role`, [{ database: 'temuevent_password_test', role: 'temuevent_app' }])
  stage = 'two simultaneous redeems: exactly one winner'
  {
    const f = await fixture(), hold = contender(true), wait = contender()
    const a = f.reset(hold.run).reset({ token: f.token, newPassword: f.next }); await bounded(hold.finished.promise)
    const b = f.reset(wait.run).reset({ token: f.token, newPassword: 'another long password' }); const rejected = assert.rejects(b, { code: 'INVALID_RESET_LINK' })
    const holder = await bounded(hold.entered.promise), waiter = await bounded(wait.entered.promise); assert.notEqual(holder, waiter); await blocked(waiter)
    hold.release.resolve(); await a; await rejected
    assert.equal(await verifyPassword(f.next, (await db.user.findUniqueOrThrow({ where: { id: f.user.id } })).passwordHash!), true)
    assert.equal(await db.authSession.count({ where: { userId: f.user.id, revokedAt: null } }), 0); passed++
  }
  for (const resetFirst of [false, true]) {
    stage = resetFirst ? 'reset wins against known-password change' : 'known-password change invalidates queued reset'
    const f = await fixture(), hold = contender(true), wait = contender()
    const change = (tx: Transaction) => createPasswordChangeService({ repository: prismaPasswordRepository(db, tx, f.now) }).change(f.actor,
      { currentPassword: f.password, newPassword: f.next })
    const recovery = (tx: Transaction) => f.reset(tx).reset({ token: f.token, newPassword: f.next })
    const a = resetFirst ? recovery(hold.run) : change(hold.run); await bounded(hold.finished.promise)
    const b = resetFirst ? change(wait.run) : recovery(wait.run)
    const rejected = assert.rejects(b, { code: resetFirst ? 'SESSION_REQUIRED' : 'INVALID_RESET_LINK' })
    await blocked(await bounded(wait.entered.promise)); hold.release.resolve(); await a; await rejected; passed++
  }
  stage = 'reset fences an old-password login proof'
  {
    const f = await fixture(), hold = contender(true), wait = contender()
    const a = f.reset(hold.run).reset({ token: f.token, newPassword: f.next }); await bounded(hold.finished.promise)
    const b = prismaSessionRepository(db, wait.run).createSession({ id: randomUUID(), userId: f.user.id,
      expectedPasswordHash: f.user.passwordHash!, tokenHash: randomBytes(32).toString('hex'), now: f.now(), expiresAt: new Date(f.now().getTime() + 3600000) })
    await blocked(await bounded(wait.entered.promise)); hold.release.resolve(); await a; assert.equal(await b, null); passed++
  }
  for (const known of [true, false]) {
    stage = 'concurrent cooldown for ' + (known ? 'known' : 'unknown') + ' email'
    const f = await fixture(), hold = contender(true), wait = contender(); f.advance(61000)
    const email = known ? f.user.email : 'unknown-' + randomUUID() + '@example.test'
    const before = await db.passwordResetToken.count({ where: { recipientEmail: email } })
    const a = f.reset(hold.run).request({ email }); await bounded(hold.finished.promise)
    const b = f.reset(wait.run).request({ email }); await blocked(await bounded(wait.entered.promise))
    hold.release.resolve(); await a; await b; assert.equal(await db.passwordResetToken.count({ where: { recipientEmail: email } }), before + 1); passed++
  }
  stage = 'claim uses skip-locked and stale worker acknowledgements cannot overwrite a newer lease'
  {
    const f = await fixture(), hold = contender(true); f.advance(61000); await f.reset().request({ email: f.user.email })
    // Suppress unrelated pending test jobs before isolating this claim scenario.
    await db.passwordResetToken.updateMany({ where: { recipientEmail: { not: f.user.email }, deliveryState: 'PENDING' }, data: { deliveryState: 'SUPPRESSED' } })
    const claim = f.repo(hold.run).claim(); await bounded(hold.finished.promise)
    assert.equal(await f.repo().claim(), null)
    hold.release.resolve(); const first = await claim; assert(first)
    f.advance(60000); const second = await f.repo().claim(); assert(second); assert.equal(second.id, first.id); assert.notEqual(second.leaseId, first.leaseId)
    await f.repo().finish(second, true); await f.repo().finish(first, false)
    assert.equal((await db.passwordResetToken.findUniqueOrThrow({ where: { id: first.id } })).deliveryState, 'ACCEPTED'); passed++
  }
  stage = 'expiry is rechecked after waiting on the user lock'
  {
    const f = await fixture(), hold = contender(true), wait = contender()
    const lock = hold.run(async tx => { await tx.$queryRaw`SELECT id FROM temuevent.users WHERE id=${f.user.id}::uuid FOR UPDATE` })
    await bounded(hold.finished.promise)
    const reset = f.reset(wait.run).reset({ token: f.token, newPassword: f.next }), rejected = assert.rejects(reset, { code: 'INVALID_RESET_LINK' })
    await blocked(await bounded(wait.entered.promise)); f.advance(900000); hold.release.resolve(); await lock; await rejected
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: f.user.id } })).passwordHash, f.user.passwordHash); passed++
  }
  console.log('RESET_RACES_OK: ' + passed + ' independent-connection PostgreSQL 18 scenarios: single winner, reset/change both orders, stale login, known/unknown cooldown, skip-locked/lease fencing and expiry while waiting. Isolated fixtures only.')
}
main().catch(error => { console.error('Reset race failed at: ' + stage); console.error(JSON.stringify({ name: error?.name, code: error?.code, message: error?.name === 'AssertionError' ? error.message : undefined })); process.exitCode = 1 }).finally(() => db.$disconnect())
