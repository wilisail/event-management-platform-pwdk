import assert from 'node:assert/strict'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createApp } from '../server/app'
import { databaseClient, disconnectDatabase } from '../server/database'
import { createRegistrationService } from '../server/auth/registration'
import { prismaRegistrationRepository } from '../server/auth/registration-repository'
import { createSessionService } from '../server/auth/sessions'
import { prismaSessionRepository } from '../server/auth/session-repository'
import { createSessionTokens, hashRefreshToken, SESSION_SECONDS } from '../server/auth/session-tokens'
import { createPasswordChangeService } from '../server/auth/change-password'
import { prismaPasswordRepository } from '../server/auth/password-repository'
import { verifyPassword } from '../server/auth/passwords'
import { registrationSavepoints } from './helpers/registration-transaction'

const db = databaseClient(), rollback = new Error('ROLLBACK_PASSWORD_CHECK'), tag = randomUUID()
const emails = ['password-customer-', 'password-organizer-', 'password-other-'].map(prefix => prefix + tag + '@example.test')
let stage = 'baseline'
async function main() {
  const fingerprint = async () => createHash('sha256').update(JSON.stringify(await db.user.findMany({ orderBy: { id: 'asc' } }))).digest('hex')
  const before = await fingerprint(), sessionsBefore = await db.authSession.count(), tokensBefore = await db.authRefreshToken.count()
  await assert.rejects(db.$transaction(async tx => {
    const atomic = registrationSavepoints(tx)
    const registration = createRegistrationService({ repository: prismaRegistrationRepository(tx, atomic) })
    const sessionRepository = prismaSessionRepository(tx, work => atomic(() => work(tx)))
    const sessions = createSessionService({ repository: sessionRepository, tokens: createSessionTokens(randomBytes(32).toString('hex')) })
    const passwords = createPasswordChangeService({ repository: prismaPasswordRepository(tx, work => atomic(() => work(tx))) })
    const server = createApp({ registrationService: registration, sessionService: sessions, passwordChangeService: passwords,
      secureCookies: false, loginRateLimit: { limit: 100, windowMs: 60000 }, passwordChangeLimit: { limit: 100, windowMs: 60000 } }).listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('No port')
    const base = 'http://127.0.0.1:' + address.port
    const post = (path: string, input: unknown, headers: Record<string, string> = {}) => fetch(base + '/api/auth/' + path,
      { method: 'POST', headers: { 'content-type': 'application/json', 'x-temuevent-client': 'web', ...headers }, body: JSON.stringify(input) })
    const cookie = (response: Response) => response.headers.getSetCookie().map(item => item.split(';')[0]).join('; ')
    const originalPassword = randomBytes(24).toString('base64url')
    try {
      const other = await registration.register({ name: 'Separate QA', email: emails[2], password: originalPassword })
      const otherLogin = await sessions.login({ email: other.email, password: originalPassword })
      for (let index = 0; index < 2; index++) {
        stage = 'both-role signup, two sessions and safe rejection'
        const role = index === 0 ? 'CUSTOMER' : 'ORGANIZER'
        const user = await registration.register({ name: 'Password QA', role, email: emails[index], password: originalPassword })
        const login = await post('login', { email: user.email, password: originalPassword }); assert.equal(login.status, 200)
        const credentials = (await login.json()).data, originalCookie = cookie(login)
        const second = await sessions.login({ email: user.email, password: originalPassword })
        const actor = await sessions.readSession(second.accessToken)
        const original = await tx.user.findUniqueOrThrow({ where: { id: user.id } })
        const headers = { cookie: originalCookie, 'x-csrf-token': credentials.csrfToken }
        const newPassword = ' ' + randomBytes(20).toString('hex') + ' 🐢 '
        assert.equal((await post('password', { currentPassword: originalPassword, newPassword }, { cookie: originalCookie })).status, 403)
        assert.equal((await post('password', { currentPassword: 'incorrect', newPassword }, headers)).status, 400)
        assert.equal((await post('password', { currentPassword: originalPassword, newPassword, userId: other.id }, headers)).status, 400)
        assert.equal((await tx.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash, original.passwordHash)

        stage = 'real atomic rollback after both password/revocation writes'
        const failure = new Error('ROLLBACK_FAILED_PASSWORD_WRITE')
        const failing = createPasswordChangeService({ repository: prismaPasswordRepository(tx,
          work => atomic(async () => { await work(tx); throw failure })) })
        await assert.rejects(failing.change({ userId: user.id, sessionId: actor.id }, { currentPassword: originalPassword, newPassword }), error => error === failure)
        assert.equal((await tx.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash, original.passwordHash)
        assert.equal(await tx.authSession.count({ where: { userId: user.id, revokedAt: null } }), 2)
        assert.equal((await sessions.readSession(second.accessToken)).user.id, user.id)

        stage = 'session expiry rechecked after acquiring mutation locks'
        const expired = createPasswordChangeService({ repository: prismaPasswordRepository(tx, work => atomic(() => work(tx)),
          () => new Date(Date.now() + (SESSION_SECONDS + 1) * 1000)) })
        await assert.rejects(expired.change({ userId: user.id, sessionId: actor.id }, { currentPassword: originalPassword, newPassword }), { code: 'SESSION_REQUIRED' })
        assert.equal((await tx.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash, original.passwordHash)

        stage = 'successful HTTP password change and all-session revocation'
        const saved = await post('password', { currentPassword: originalPassword, newPassword }, headers)
        assert.equal(saved.status, 200); assert.equal(saved.headers.getSetCookie().length, 2)
        const result = await saved.json(); assert.deepEqual(result.data, { signInRequired: true })
        assert.equal(JSON.stringify(result).includes(newPassword), false)
        const updated = await tx.user.findUniqueOrThrow({ where: { id: user.id } })
        assert.notEqual(updated.passwordHash, original.passwordHash)
        assert(updated.passwordHash?.startsWith('scrypt-v1$'))
        assert.equal(await verifyPassword(newPassword, updated.passwordHash!), true)
        assert.equal(await verifyPassword(originalPassword, updated.passwordHash!), false)
        assert.equal(await verifyPassword(newPassword.trim(), updated.passwordHash!), false)
        assert.equal(updated.email, original.email); assert.equal(updated.role, original.role); assert.equal(updated.referralCode, original.referralCode)
        assert.equal(await tx.authSession.count({ where: { userId: user.id, revokedAt: null } }), 0)
        assert.equal((await fetch(base + '/api/me', { headers: { cookie: originalCookie } })).status, 401)
        await assert.rejects(sessions.readSession(second.accessToken), { status: 401 })
        await assert.rejects(sessions.refresh(second.refreshToken), { status: 401 })
        const originalRefresh = originalCookie.split('temuevent_refresh=')[1]
        await assert.rejects(sessions.refresh(originalRefresh), { status: 401 })
        assert(await tx.authRefreshToken.findUnique({ where: { tokenHash: hashRefreshToken(second.refreshToken) } }))
        assert.equal((await sessions.readSession(otherLogin.accessToken)).user.id, other.id)

        stage = 'stale login proof rejected; only the exact new password signs in'
        const count = await tx.authSession.count({ where: { userId: user.id } })
        assert.equal(await sessionRepository.createSession({ id: randomUUID(), userId: user.id, expectedPasswordHash: original.passwordHash!,
          tokenHash: randomBytes(32).toString('hex'), now: new Date(), expiresAt: new Date(Date.now() + 60000) }), null)
        assert.equal(await tx.authSession.count({ where: { userId: user.id } }), count)
        assert.equal((await post('login', { email: user.email, password: originalPassword })).status, 401)
        assert.equal((await post('login', { email: user.email, password: newPassword })).status, 200)
      }
    } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
    throw rollback
  }, { timeout: 240000 }), error => error === rollback)
  stage = 'fixture rollback and original fingerprints'
  assert.equal(await db.user.count({ where: { email: { in: emails } } }), 0)
  assert.equal(await fingerprint(), before)
  assert.equal(await db.authSession.count(), sessionsBefore); assert.equal(await db.authRefreshToken.count(), tokensBefore)
  console.log('PASSWORD_DB_OK: both-role real scrypt changes, exact Unicode/spaces, current-password/CSRF/owner checks, atomic rollback, expiry recheck, all-session revocation, other-account isolation, stale-login fencing and new-password login; all SQL fixtures rolled back and original users/sessions/tokens unchanged.')
}
main().catch(error => {
  const cause = error?.actual ?? error
  console.error('Password verification failed at: ' + stage)
  console.error(JSON.stringify({ name: cause?.name, code: cause?.code, model: cause?.meta?.modelName,
    driverCode: cause?.meta?.driverAdapterError?.cause?.originalCode }))
  process.exitCode = 1
}).finally(disconnectDatabase)
