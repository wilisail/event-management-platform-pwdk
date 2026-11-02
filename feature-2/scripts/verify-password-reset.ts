import assert from 'node:assert/strict'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { databaseClient, disconnectDatabase } from '../server/database'
import { createPasswordResetService, resetDigest, type ResetRepository } from '../server/auth/password-reset'
import { prismaResetRepository } from '../server/auth/reset-repository'
import { createRegistrationService } from '../server/auth/registration'
import { prismaRegistrationRepository } from '../server/auth/registration-repository'
import { createSessionService } from '../server/auth/sessions'
import { prismaSessionRepository } from '../server/auth/session-repository'
import { createSessionTokens } from '../server/auth/session-tokens'
import { prismaPasswordRepository } from '../server/auth/password-repository'
import { createPasswordChangeService } from '../server/auth/change-password'
import { verifyPassword } from '../server/auth/passwords'
import { registrationSavepoints } from './helpers/registration-transaction'
import type { EmailMessage } from '../server/email/resend'

const db = databaseClient(), rollback = new Error('ROLLBACK_RESET_QA'), tag = randomUUID()
let stage = 'baseline'
async function main() {
  const fingerprint = async () => createHash('sha256').update(JSON.stringify(await db.user.findMany({ orderBy: { id: 'asc' } }))).digest('hex')
  const before = await fingerprint(), sessionsBefore = await db.authSession.count(), tokensBefore = await db.authRefreshToken.count(), resetBefore = await db.passwordResetToken.count()
  await assert.rejects(db.$transaction(async tx => {
    const atomic = registrationSavepoints(tx)
    let time = new Date()
    const now = () => new Date(Math.max(time.getTime(), Date.now())), advance = (ms: number) => { time = new Date(now().getTime() + ms) }
    const registration = createRegistrationService({ repository: prismaRegistrationRepository(tx, atomic) })
    const sessions = createSessionService({ repository: prismaSessionRepository(tx, work => atomic(() => work(tx))),
      tokens: createSessionTokens(randomBytes(32).toString('hex')) })
    const repository = prismaResetRepository(tx, work => atomic(() => work(tx)), now), secret = randomBytes(32).toString('hex')
    const mail: EmailMessage[] = []
    const service = (repo: ResetRepository = repository, send = async (message: EmailMessage) => { mail.push(message) }) =>
      createPasswordResetService({ repository: repo, signingSecret: secret, origin: 'https://temuevent.example', now, mailer: { send } })
    const reset = service(), password = randomBytes(24).toString('hex')
    const other = await registration.register({ name: 'Reset separate QA', email: 'reset-other-' + tag + '@example.test', password })
    const otherLogin = await sessions.login({ email: other.email, password })
    const token = () => mail.at(-1)!.text.match(/#token=([A-Za-z0-9_-]{43})/)![1]
    for (const role of ['CUSTOMER', 'ORGANIZER'] as const) {
      stage = role + ': persisted queue, digests and suppression'
      const user = await registration.register({ name: 'Reset QA', email: 'reset-' + role.toLowerCase() + '-' + tag + '@example.test', password, role })
      // QA clock follows user creation; creation after a request must not receive that earlier capability.
      time = new Date(Math.max(time.getTime(), Date.now()))
      const first = await sessions.login({ email: user.email, password }), second = await sessions.login({ email: user.email, password })
      const original = await tx.user.findUniqueOrThrow({ where: { id: user.id } })
      await reset.request({ email: user.email }); await reset.request({ email: user.email })
      assert.equal(await tx.passwordResetToken.count({ where: { recipientEmail: user.email } }), 1)
      await reset.request({ email: 'unknown-' + role.toLowerCase() + '-' + tag + '@example.test' })
      await reset.dispatchPending()
      assert.equal(mail.filter(m => m.to === user.email).length, 1)
      const initialToken = token(), row = await tx.passwordResetToken.findUniqueOrThrow({ where: { tokenHash: resetDigest(initialToken) } })
      assert.equal(row.userId, user.id); assert.equal(row.deliveryState, 'ACCEPTED'); assert.equal(row.credentialFingerprint, resetDigest(original.passwordHash!))
      assert.equal(JSON.stringify(row).includes(initialToken), false)
      assert.equal(await tx.passwordResetToken.count({ where: { recipientEmail: { startsWith: 'unknown-' + role.toLowerCase() }, deliveryState: 'SUPPRESSED' } }), 1)
      stage = role + ': rollback after password, token consumption and session revocation'
      const failure = new Error('ROLLBACK_RESET_WRITES')
      const failing = service({ ...repository, redeem: input => atomic(async () => { await repository.redeem(input); throw failure }) })
      const newPassword = ' ' + randomBytes(18).toString('hex') + ' 🐢 '
      await assert.rejects(failing.reset({ token: initialToken, newPassword }), error => error === failure)
      assert.equal((await tx.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash, original.passwordHash)
      assert.equal((await tx.passwordResetToken.findUniqueOrThrow({ where: { id: row.id } })).consumedAt, null)
      assert.equal(await tx.authSession.count({ where: { userId: user.id, revokedAt: null } }), 2)
      stage = role + ': single-use atomic redemption, exact password, all-device revocation and ownership'
      await reset.reset({ token: initialToken, newPassword })
      const updated = await tx.user.findUniqueOrThrow({ where: { id: user.id } })
      assert.equal(await verifyPassword(newPassword, updated.passwordHash!), true)
      assert.equal(await verifyPassword(newPassword.trim(), updated.passwordHash!), false)
      await assert.rejects(reset.reset({ token: initialToken, newPassword: password }), { code: 'INVALID_RESET_LINK' })
      for (const old of [first, second]) { await assert.rejects(sessions.readSession(old.accessToken), { status: 401 }); await assert.rejects(sessions.refresh(old.refreshToken), { status: 401 }) }
      assert.equal((await sessions.readSession(otherLogin.accessToken)).user.id, other.id)
      await assert.rejects(sessions.login({ email: user.email, password }), { status: 401 })
      const currentLogin = await sessions.login({ email: user.email, password: newPassword })
      assert.equal((await sessions.readSession(currentLogin.accessToken)).user.role, role)
      stage = role + ': old links plus not-yet-activated requests invalidated by known-password change'
      advance(61000); await reset.request({ email: user.email }); await reset.dispatchPending(); const beforeChangeToken = token()
      advance(61000); await reset.request({ email: user.email })
      const changes = createPasswordChangeService({ repository: prismaPasswordRepository(tx, work => atomic(() => work(tx)), now) })
      const actor = await sessions.readSession(currentLogin.accessToken)
      await changes.change({ userId: user.id, sessionId: actor.id }, { currentPassword: newPassword, newPassword: password })
      await assert.rejects(reset.reset({ token: beforeChangeToken, newPassword }), { code: 'INVALID_RESET_LINK' })
      assert.equal(await tx.passwordResetToken.count({ where: { recipientEmail: user.email, consumedAt: null } }), 0)
      const sent = mail.length; await reset.dispatchPending(); assert.equal(mail.length, sent)
      stage = role + ': expiry exactly at deadline; concurrent version recheck'
      advance(3600000); await reset.request({ email: user.email }); await reset.dispatchPending(); const expiredToken = token()
      advance(900000); await assert.rejects(reset.reset({ token: expiredToken, newPassword }), { code: 'INVALID_RESET_LINK' })
      advance(3600000); await reset.request({ email: user.email }); await reset.dispatchPending(); const stale = token()
      await tx.user.update({ where: { id: user.id }, data: { passwordHash: updated.passwordHash } })
      await assert.rejects(reset.reset({ token: stale, newPassword }), { code: 'INVALID_RESET_LINK' })
    }
    stage = 'worker retries, stable token, stale lease acknowledgement'
    advance(3600000); await reset.request({ email: other.email }); const abandoned = await repository.claim(); assert(abandoned)
    advance(60000); let attempts = 0
    const retryMail: EmailMessage[] = []
    const retry = service(repository, async message => { retryMail.push(message); if (++attempts === 1) throw new Error('provider unavailable') })
    await retry.dispatchPending(); assert.equal((await tx.passwordResetToken.findUniqueOrThrow({ where: { id: abandoned.id } })).deliveryState, 'RETRY')
    advance(10000); await retry.dispatchPending(); assert.equal(retryMail.length, 2); assert.deepEqual(retryMail[0], retryMail[1])
    await repository.finish(abandoned, false)
    assert.equal((await tx.passwordResetToken.findUniqueOrThrow({ where: { id: abandoned.id } })).deliveryState, 'ACCEPTED')
    stage = 'a worker resuming after its lease expires leaves the job recoverable'
    advance(3600000); await reset.request({ email: other.email })
    const late = await repository.claim(); assert(late)
    advance(60000); assert.equal(await repository.activate(late, late.tokenHash), null)
    assert.equal((await tx.passwordResetToken.findUniqueOrThrow({ where: { id: late.id } })).deliveryState, 'SENDING')
    const recovered = await repository.claim(); assert(recovered); assert.equal(recovered.id, late.id)
    assert(await repository.activate(recovered, recovered.tokenHash)); await repository.finish(recovered, true)
    stage = 'backend grants and constraints'
    const grants = await tx.$queryRaw<{ anon: boolean; authenticated: boolean; backend: boolean; rls: boolean }[]>`SELECT
      has_table_privilege('anon', 'temuevent.password_reset_tokens', 'SELECT') AS anon,
      has_table_privilege('authenticated', 'temuevent.password_reset_tokens', 'SELECT') AS authenticated,
      has_table_privilege('temuevent_app', 'temuevent.password_reset_tokens', 'SELECT,INSERT,UPDATE,DELETE') AS backend,
      (SELECT relrowsecurity FROM pg_class WHERE oid='temuevent.password_reset_tokens'::regclass) AS rls`
    assert.deepEqual(grants, [{ anon: false, authenticated: false, backend: true, rls: true }])
    throw rollback
  }, { timeout: 240000 }), error => error === rollback)
  stage = 'rollback and original shared-data fingerprints'
  assert.equal(await fingerprint(), before); assert.equal(await db.authSession.count(), sessionsBefore)
  assert.equal(await db.authRefreshToken.count(), tokensBefore); assert.equal(await db.passwordResetToken.count(), resetBefore)
  console.log('RESET_DB_OK: real restricted-role SQL/scrypt, both roles, private digest queue, generic suppression, cooldown, atomic rollback, single-use/expiry/version checks, all-session revocation, other-account isolation, pending/issued link invalidation on password change, retry/idempotency and stale-lease fencing; all QA fixtures rolled back.')
}
main().catch(error => { console.error('Reset verification failed at: ' + stage); console.error(JSON.stringify({ name: error?.name, code: error?.code, message: error?.name === 'AssertionError' ? error.message : undefined,
  model: error?.meta?.modelName, driverCode: error?.meta?.driverAdapterError?.cause?.originalCode })); process.exitCode = 1 }).finally(disconnectDatabase)
