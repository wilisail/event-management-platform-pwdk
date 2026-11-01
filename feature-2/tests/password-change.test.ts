import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import { createApp } from '../server/app'
import { createPasswordChangeService } from '../server/auth/change-password'
import { PasswordWorkLimitError } from '../server/auth/passwords'
import { passwordFixture } from './helpers/password-change'
import { loginFields, testAccount } from './helpers/sessions'

const fields = { currentPassword: loginFields.password, newPassword: 'A different long passphrase 🐢 ' }
const other = { ...testAccount, id: '22222222-2222-4222-8222-222222222222', email: 'other@example.test' }
async function actor(f: ReturnType<typeof passwordFixture>) {
  const credentials = await f.service.login(loginFields)
  return { credentials, session: await f.service.readSession(credentials.accessToken) }
}
async function http(f: ReturnType<typeof passwordFixture>, work: (base: string, headers: Record<string, string>) => Promise<void>,
  options: Parameters<typeof createApp>[0] = {}) {
  const { credentials } = await actor(f)
  const server = createApp({ sessionService: f.service, passwordChangeService: f.passwordService, now: f.now, ...options }).listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('No port')
  const prefix = options.secureCookies ? '__Host-' : ''
  try { await work('http://127.0.0.1:' + address.port, {
    cookie: prefix + 'temuevent_access=' + credentials.accessToken + '; ' + prefix + 'temuevent_refresh=' + credentials.refreshToken,
    'x-temuevent-client': 'web', 'x-csrf-token': credentials.csrfToken, 'content-type': 'application/json',
  }) } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
}

test('password change preserves Unicode/spaces, revokes all own sessions and leaves another account active', async () => {
  const f = passwordFixture(); f.users.set(other.email, { ...other })
  const first = await actor(f), second = await f.service.login(loginFields), separate = await f.service.login({ ...loginFields, email: other.email })
  await f.passwordService.change({ userId: first.session.user.id, sessionId: first.session.id }, fields)
  assert.equal(f.users.get(testAccount.email)!.passwordHash, 'test-only:' + fields.newPassword)
  for (const value of [first.credentials, second]) {
    await assert.rejects(f.service.readSession(value.accessToken), { status: 401 })
    await assert.rejects(f.service.refresh(value.refreshToken), { status: 401 })
  }
  assert.equal((await f.service.readSession(separate.accessToken)).user.id, other.id)
  await assert.rejects(f.service.login(loginFields), { code: 'INVALID_CREDENTIALS' })
  assert.equal((await f.service.login({ ...loginFields, password: fields.newPassword })).user.id, testAccount.id)
  await assert.rejects(f.service.login({ ...loginFields, password: fields.newPassword.trim() }), { code: 'INVALID_CREDENTIALS' })
})
test('invalid password fields, extra owner fields, incorrect proof and reuse never mutate credentials/sessions', async () => {
  const f = passwordFixture(), { session } = await actor(f), owner = { userId: session.user.id, sessionId: session.id }
  for (const input of [null, {}, { ...fields, userId: other.id }, { ...fields, role: 'ORGANIZER' },
    { ...fields, currentPassword: '' }, { ...fields, currentPassword: 'x'.repeat(129) },
    { ...fields, newPassword: 'short' }, { ...fields, newPassword: ' '.repeat(15) }, { ...fields, newPassword: '🐢'.repeat(129) }]) {
    await assert.rejects(f.passwordService.change(owner, input), { code: 'INVALID_PASSWORD_CHANGE' })
  }
  await assert.rejects(f.passwordService.change(owner, { ...fields, currentPassword: 'wrong' }), { code: 'INVALID_CURRENT_PASSWORD' })
  await assert.rejects(f.passwordService.change(owner, { ...fields, newPassword: fields.currentPassword }), { code: 'PASSWORD_UNCHANGED' })
  assert.equal(f.users.get(testAccount.email)!.passwordHash, testAccount.passwordHash)
  assert.equal(f.sessions.get(session.id)!.revokedAt, null)
})
test('a session revoked or password changed during slow hashing cannot commit the stale change', async () => {
  for (const kind of ['revoked', 'changed'] as const) {
    const f = passwordFixture(), { session } = await actor(f)
    const service = createPasswordChangeService({ repository: f.passwordRepository, verify: f.verify,
      hash: async password => {
        if (kind === 'revoked') f.sessions.get(session.id)!.revokedAt = f.now()
        else f.users.get(testAccount.email)!.passwordHash = 'test-only:another saved password'
        return f.hash(password)
      } })
    await assert.rejects(service.change({ userId: session.user.id, sessionId: session.id }, fields),
      { code: kind === 'revoked' ? 'SESSION_REQUIRED' : 'PASSWORD_CHANGE_CONFLICT' })
    assert.notEqual(f.users.get(testAccount.email)!.passwordHash, 'test-only:' + fields.newPassword)
  }
})
test('busy verification/hashing and repository failures do not report a successful password change', async () => {
  for (const step of ['verify', 'hash', 'replace'] as const) {
    const f = passwordFixture(), { session } = await actor(f)
    const service = createPasswordChangeService({ repository: { ...f.passwordRepository,
      ...(step === 'replace' ? { replace: async () => { throw new Error('private database detail') } } : {}) },
      verify: step === 'verify' ? async () => { throw new PasswordWorkLimitError() } : f.verify,
      hash: step === 'hash' ? async () => { throw new PasswordWorkLimitError() } : f.hash })
    await assert.rejects(service.change({ userId: session.user.id, sessionId: session.id }, fields))
    assert.equal(f.users.get(testAccount.email)!.passwordHash, testAccount.passwordHash)
    assert.equal(f.sessions.get(session.id)!.revokedAt, null)
  }
})
test('password HTTP guards reject anonymous/spoofed/mixed-session/CSRF requests before body parsing', async () => {
  const f = passwordFixture()
  await http(f, async (base, headers) => {
    const post = (h: Record<string, string>) => fetch(base + '/api/auth/password', { method: 'POST', headers: h, body: '{invalid' })
    assert.equal((await post({ 'x-temuevent-client': 'web', 'content-type': 'application/json', 'x-demo-persona': 'organizer' })).status, 401)
    assert.equal((await post({ ...headers, 'x-csrf-token': 'wrong' })).status, 403)
    assert.equal((await post({ ...headers, 'sec-fetch-site': 'cross-site' })).status, 403)
    const second = await f.service.login(loginFields)
    assert.equal((await post({ ...headers, cookie: headers.cookie.split(';')[0] + '; temuevent_refresh=' + second.refreshToken,
      'x-csrf-token': second.csrfToken })).status, 403)
    assert.equal(f.users.get(testAccount.email)!.passwordHash, testAccount.passwordHash)
  })
})
test('both roles change only their password and HTTP clears matching production cookie names/attributes', async () => {
  for (const role of ['CUSTOMER', 'ORGANIZER'] as const) {
    const f = passwordFixture(); f.users.get(testAccount.email)!.role = role
    await http(f, async (base, headers) => {
      const response = await fetch(base + '/api/auth/password?userId=' + other.id, { method: 'POST',
        headers: { ...headers, 'x-user-id': other.id }, body: JSON.stringify(fields) })
      assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.deepEqual((await response.json()).data, { signInRequired: true })
      assert.equal(response.headers.getSetCookie().length, 2)
      for (const cookie of response.headers.getSetCookie()) {
        assert.match(cookie, /^__Host-temuevent_/); assert.match(cookie, /; Secure/); assert.match(cookie, /; HttpOnly/)
        assert.match(cookie, /SameSite=Lax/); assert.match(cookie, /Path=\//); assert.equal(cookie.includes('Domain='), false)
        assert.match(cookie, /Expires=Thu, 01 Jan 1970/)
      }
      assert.equal((await fetch(base + '/api/me', { headers })).status, 401)
    }, { secureCookies: true })
  }
})
test('password HTTP bounds JSON and attempts without leaking passwords or private failures', async () => {
  const f = passwordFixture()
  await http(f, async (base, headers) => {
    const post = (body: string, h = headers) => fetch(base + '/api/auth/password', { method: 'POST', headers: h, body })
    assert.equal((await post('plain', { ...headers, 'content-type': 'text/plain' })).status, 415)
    assert.equal((await post('{bad')).status, 400)
    assert.equal((await post(JSON.stringify({ ...fields, newPassword: 'x'.repeat(3000) }))).status, 413)
    const invalid = await post(JSON.stringify({ ...fields, currentPassword: 'wrong-private-passphrase-732' }))
    assert.equal(invalid.status, 400); assert.equal((await invalid.text()).includes('wrong-private-passphrase-732'), false)
    const response = await post(JSON.stringify(fields))
    assert.equal(response.status, 429)
    assert.equal(f.users.get(testAccount.email)!.passwordHash, testAccount.passwordHash)
  }, { passwordChangeLimit: { limit: 3, windowMs: 60000 } })
  const failing = passwordFixture()
  await http(failing, async (base, headers) => {
    const response = await fetch(base + '/api/auth/password', { method: 'POST', headers, body: JSON.stringify(fields) })
    assert.equal(response.status, 503)
    const text = await response.text(); assert.equal(text.includes('credential-secret'), false); assert.equal(text.includes(fields.newPassword), false)
  }, { passwordChangeService: { change: async () => { throw new Error('credential-secret') } } })
})
