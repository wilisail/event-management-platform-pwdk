import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSessionService, SessionError } from '../server/auth/sessions'
import { createSessionTokens, hashRefreshToken, ACCESS_SECONDS, SESSION_SECONDS } from '../server/auth/session-tokens'
import { PasswordWorkLimitError } from '../server/auth/passwords'
import { sessionFixture, memorySessions, loginFields, testAccount, testSecret } from './helpers/sessions'

const status = (expected: number) => (error: unknown) => error instanceof SessionError && error.status === expected

test('a login whose password proof became stale cannot create a session after a password change', async () => {
  const f = memorySessions()
  const service = createSessionService({ repository: f.repository, tokens: createSessionTokens(testSecret),
    verifyPassword: async () => { f.users.get(testAccount.email)!.passwordHash = 'test-only:a changed password'; return true } })
  await assert.rejects(service.login(loginFields), { code: 'INVALID_CREDENTIALS' })
  assert.equal(f.sessions.size, 0); assert.equal(f.tokens.size, 0)
})

test('login normalizes email, verifies a raw password and persists only a refresh digest', async () => {
  const f = sessionFixture()
  const result = await f.service.login({ ...loginFields, email: ' SESSION@EXAMPLE.TEST ' })
  assert.equal(result.user.id, testAccount.id)
  assert.equal('passwordHash' in result.user, false)
  assert.equal(f.sessions.size, 1)
  assert.equal(result.accessExpiresAt.getTime() - f.now().getTime(), ACCESS_SECONDS * 1000)
  assert.equal(result.sessionExpiresAt.getTime() - f.now().getTime(), SESSION_SECONDS * 1000)
  assert(f.tokens.has(hashRefreshToken(result.refreshToken)))
  assert.equal(f.tokens.has(result.refreshToken), false)
  assert.equal((await f.service.readSession(result.accessToken)).user.id, testAccount.id)
})

test('wrong/missing/passwordless accounts use generic errors without issuing sessions', async () => {
  const f = sessionFixture()
  const errors: string[] = []
  for (const input of [{ ...loginFields, password: 'wrong' }, { ...loginFields, email: 'absent@example.test' }]) {
    try { await f.service.login(input); assert.fail('Expected rejection') }
    catch (error) { assert(error instanceof SessionError); errors.push(error.message); assert.equal(error.status, 401) }
  }
  f.users.get(testAccount.email)!.passwordHash = null
  await assert.rejects(f.service.login(loginFields), status(401))
  assert.equal(errors[0], errors[1])
  assert.equal(f.sessions.size, 0)
})

test('invalid login input cannot supply roles, IDs or unbounded passwords', async () => {
  const f = sessionFixture()
  for (const input of [{ ...loginFields, role: 'ORGANIZER' }, { ...loginFields, password: 'x'.repeat(129) },
    { ...loginFields, email: 'bad' }, { ...loginFields, password: '' }, null]) {
    await assert.rejects(f.service.login(input), status(400))
  }
  await assert.rejects(f.service.login({ ...loginFields, password: ' ' + loginFields.password }), status(401))
  assert.equal(f.sessions.size, 0)
})

test('refresh rotates once, retains absolute expiry and replay revokes the whole session', async () => {
  const f = sessionFixture()
  const original = await f.service.login(loginFields)
  f.advance(60 * 1000)
  const next = await f.service.refresh(original.refreshToken)
  assert.notEqual(next.refreshToken, original.refreshToken)
  assert.notEqual(next.csrfToken, original.csrfToken)
  assert.equal(next.sessionExpiresAt.getTime(), original.sessionExpiresAt.getTime())
  assert(f.tokens.get(hashRefreshToken(original.refreshToken))!.consumedAt)
  await assert.rejects(f.service.refresh(original.refreshToken), status(401))
  await assert.rejects(f.service.readSession(next.accessToken), status(401))
  await assert.rejects(f.service.refresh(next.refreshToken), status(401))
})

test('two simulated simultaneous refreshes cannot both succeed', async () => {
  const f = sessionFixture()
  const original = await f.service.login(loginFields)
  const results = await Promise.allSettled([f.service.refresh(original.refreshToken), f.service.refresh(original.refreshToken)])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(results.filter(result => result.status === 'rejected').length, 1)
  assert([...f.sessions.values()][0].revokedAt)
})

test('access expires before the session, refresh restores access, and seven days is absolute', async () => {
  const f = sessionFixture()
  const first = await f.service.login(loginFields)
  f.advance(ACCESS_SECONDS * 1000)
  await assert.rejects(f.service.readSession(first.accessToken), status(401))
  const renewed = await f.service.refresh(first.refreshToken)
  assert.equal((await f.service.readSession(renewed.accessToken)).user.id, testAccount.id)
  f.advance((SESSION_SECONDS - ACCESS_SECONDS) * 1000)
  await assert.rejects(f.service.refresh(renewed.refreshToken), status(401))
  for (const token of [null, '', 'broken']) await assert.rejects(f.service.refresh(token), status(401))
})

test('logout is idempotent, invalidates access immediately and does not revoke another login', async () => {
  const f = sessionFixture()
  const first = await f.service.login(loginFields), second = await f.service.login(loginFields)
  await f.service.logout(first.refreshToken)
  await f.service.logout(first.refreshToken)
  await f.service.logout(null)
  await assert.rejects(f.service.readSession(first.accessToken), status(401))
  assert.equal((await f.service.readSession(second.accessToken)).user.id, testAccount.id)
  f.users.get(testAccount.email)!.role = 'ORGANIZER'
  assert.equal((await f.service.readSession(second.accessToken)).user.role, 'ORGANIZER')
})

test('bounded hashing work has an explicit temporary failure response', async () => {
  const f = memorySessions()
  const service = createSessionService({ repository: f.repository, tokens: createSessionTokens(testSecret),
    verifyPassword: async () => { throw new PasswordWorkLimitError() } })
  await assert.rejects(service.login(loginFields), status(503))
  assert.equal(f.sessions.size, 0)
})
