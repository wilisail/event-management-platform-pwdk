import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { createApp, type AppOptions } from '../server/app'
import { resetDigest, resetOrigin } from '../server/auth/password-reset'
import { PasswordWorkLimitError } from '../server/auth/passwords'
import { resetFixture, messageToken } from './helpers/password-reset'
import { loginFields, testAccount } from './helpers/sessions'
import { resendMailer, MailDeliveryError } from '../server/email/resend'

const nextPassword = ' 新しい 🐢 password with spaces '
async function http(f: ReturnType<typeof resetFixture>, run: (base: string) => Promise<void>, options: AppOptions = {}) {
  const server = createApp({ passwordResetService: f.resetService, secureCookies: true, ...options }).listen(0, '127.0.0.1')
  await once(server, 'listening'); const address = server.address()
  assert(address && typeof address !== 'string')
  try { await run('http://127.0.0.1:' + address.port) }
  finally { await new Promise<void>(resolve => server.close(() => resolve())) }
}
const headers = { 'content-type': 'application/json', 'x-temuevent-client': 'web' }
const post = (base: string, path: string, body: unknown, extra = {}) => fetch(base + '/api/auth/' + path,
  { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(body) })

test('known/unknown/cooldown requests enqueue without sending or disclosing an account', async () => {
  const f = resetFixture()
  await http(f, async base => {
    const known = await post(base, 'forgot-password', { email: ' SESSION@EXAMPLE.TEST ' })
    const unknown = await post(base, 'forgot-password', { email: 'unknown@example.test' })
    const repeat = await post(base, 'forgot-password', { email: testAccount.email })
    assert.equal(known.status, 202); assert.equal(unknown.status, 202); assert.equal(repeat.status, 202)
    assert.deepEqual(await known.json(), await unknown.json()); assert.equal(f.jobs.size, 2)
    await f.resetService.dispatchPending(); assert.equal(f.mail.length, 1)
    assert.equal([...f.jobs.values()].find(j => j.recipientEmail.startsWith('unknown'))!.deliveryState, 'SUPPRESSED')
  })
})
test('enqueue returns independently of a stalled provider; only digests are persisted', async () => {
  const f = resetFixture(); let release!: () => void
  const blocked = new Promise<void>(resolve => { release = resolve })
  const service = f.makeResetService({ mailer: { async send(message) { f.mail.push(message); await blocked } } })
  await service.request({ email: testAccount.email }); assert.equal(f.mail.length, 0)
  const sending = service.dispatchPending()
  await service.request({ email: 'not-registered@example.test' })
  await new Promise(resolve => setImmediate(resolve)); assert.equal(f.mail.length, 1)
  const token = messageToken(f.mail[0]), job = [...f.jobs.values()][0]
  assert.match(token, /^[A-Za-z0-9_-]{43}$/); assert.equal(job.tokenHash, resetDigest(token))
  assert.equal(JSON.stringify(job).includes(token), false)
  release(); await sending
})
test('both roles recover once, revoke all own sessions and preserve other account credentials', async () => {
  for (const role of ['CUSTOMER', 'ORGANIZER'] as const) {
    const f = resetFixture(); f.users.get(testAccount.email)!.role = role
    const first = await f.service.login(loginFields), second = await f.service.login(loginFields)
    const other = { ...testAccount, id: '22222222-2222-4222-8222-222222222222', email: 'separate@example.test' }
    f.users.set(other.email, other); const separate = await f.service.login({ ...loginFields, email: other.email })
    await f.resetService.request({ email: testAccount.email }); await f.resetService.dispatchPending()
    const token = messageToken(f.mail[0])
    await http(f, async base => {
      const saved = await post(base, 'reset-password', { token, newPassword: nextPassword }, { 'x-user-id': other.id })
      assert.equal(saved.status, 200); assert.deepEqual((await saved.json()).data, { signInRequired: true })
      for (const cookie of saved.headers.getSetCookie()) {
        assert.match(cookie, /^__Host-temuevent_/); assert.match(cookie, /; Secure/); assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/)
      }
      assert.equal((await post(base, 'reset-password', { token, newPassword: 'another new password' })).status, 400)
    })
    for (const old of [first, second]) {
      await assert.rejects(f.service.readSession(old.accessToken), { status: 401 })
      await assert.rejects(f.service.refresh(old.refreshToken), { status: 401 })
    }
    assert.equal((await f.service.readSession(separate.accessToken)).user.id, other.id)
    await assert.rejects(f.service.login(loginFields), { status: 401 })
    assert.equal((await f.service.login({ ...loginFields, password: nextPassword })).user.role, role)
    await assert.rejects(f.service.login({ ...loginFields, password: nextPassword.trim() }), { status: 401 })
  }
})
test('expired links and links issued before a password change cannot overwrite credentials', async () => {
  for (const kind of ['expiry', 'password-change'] as const) {
    const f = resetFixture(); await f.resetService.request({ email: testAccount.email }); await f.resetService.dispatchPending()
    const token = messageToken(f.mail[0])
    if (kind === 'expiry') f.advance(900000)
    else f.users.get(testAccount.email)!.passwordHash = 'test-only:changed separately now'
    const before = f.users.get(testAccount.email)!.passwordHash
    await assert.rejects(f.resetService.reset({ token, newPassword: nextPassword }), { code: 'INVALID_RESET_LINK' })
    assert.equal(f.users.get(testAccount.email)!.passwordHash, before)
  }
})
test('time/version is rechecked after slow hashing; bounded hash work returns safe busy result', async () => {
  for (const kind of ['expiry', 'changed', 'busy'] as const) {
    const f = resetFixture(); await f.resetService.request({ email: testAccount.email }); await f.resetService.dispatchPending()
    const service = f.makeResetService({ hash: async password => {
      if (kind === 'busy') throw new PasswordWorkLimitError()
      if (kind === 'expiry') f.advance(900000)
      else f.users.get(testAccount.email)!.passwordHash = 'test-only:concurrent password now'
      return f.hash(password)
    } })
    await assert.rejects(service.reset({ token: messageToken(f.mail[0]), newPassword: nextPassword }),
      { code: kind === 'busy' ? 'AUTH_BUSY' : 'INVALID_RESET_LINK' })
  }
})
test('retry uses the same capability/idempotency key; crash lease recovery and key rotation are fenced', async () => {
  const f = resetFixture(); let attempts = 0
  const mail: typeof f.mail = []
  const service = f.makeResetService({ mailer: { async send(message) { mail.push(message); if (++attempts === 1) throw new Error('private provider data') } } })
  await service.request({ email: testAccount.email }); await service.dispatchPending()
  assert.equal([...f.jobs.values()][0].deliveryState, 'RETRY')
  await service.dispatchPending(); assert.equal(mail.length, 1)
  f.advance(5000); await service.dispatchPending(); assert.equal(mail.length, 2); assert.deepEqual(mail[0], mail[1])
  assert.equal([...f.jobs.values()][0].deliveryState, 'ACCEPTED')
  f.advance(61000); await service.request({ email: testAccount.email })
  const abandoned = await f.resetRepository.claim(); assert(abandoned)
  f.advance(60000); const replacement = f.makeResetService(); await replacement.dispatchPending()
  await f.resetRepository.finish(abandoned, false)
  assert.equal(f.jobs.get(abandoned.id)!.deliveryState, 'ACCEPTED')
  f.advance(61000); await service.request({ email: testAccount.email })
  await f.makeResetService({ signingSecret: 'cd'.repeat(32) }).dispatchPending()
  assert.equal([...f.jobs.values()].at(-1)!.deliveryState, 'SUPPRESSED')
})
test('repeated provider failures stop after three attempts and never change passwords', async () => {
  const f = resetFixture(), before = f.users.get(testAccount.email)!.passwordHash
  const service = f.makeResetService({ mailer: { async send() { throw new MailDeliveryError(403) } } })
  await service.request({ email: testAccount.email })
  for (let i = 0; i < 4; i++) { await service.dispatchPending(); f.advance(20000) }
  assert.equal([...f.jobs.values()][0].deliveryState, 'FAILED'); assert.equal([...f.jobs.values()][0].attemptCount, 3)
  assert.equal(f.users.get(testAccount.email)!.passwordHash, before)
})
test('strict inputs, JSON bounds, origin/client guards, separate limits and safe failures', async () => {
  const f = resetFixture()
  for (const value of [null, {}, { email: 'bad' }, { email: testAccount.email, userId: testAccount.id }]) {
    await assert.rejects(f.resetService.request(value), { code: 'INVALID_RESET_EMAIL' })
  }
  for (const value of [{ token: 'x', newPassword: nextPassword }, { token: 'x'.repeat(43), newPassword: 'short' },
    { token: 'x'.repeat(43), newPassword: nextPassword, userId: testAccount.id }]) {
    await assert.rejects(f.resetService.reset(value), { code: 'INVALID_PASSWORD_RESET' })
  }
  await http(f, async base => {
    assert.equal((await post(base, 'forgot-password', { email: testAccount.email }, { origin: 'https://evil.example' })).status, 403)
    assert.equal((await post(base, 'forgot-password', {}, { 'sec-fetch-site': 'cross-site' })).status, 403)
    assert.equal((await post(base, 'forgot-password', {}, { 'x-temuevent-client': '' })).status, 403)
    assert.equal((await post(base, 'forgot-password', {}, { 'content-type': 'text/plain' })).status, 415)
    assert.equal((await post(base, 'forgot-password', { email: 'x'.repeat(3000) })).status, 413)
    assert.equal((await post(base, 'forgot-password', { email: testAccount.email })).status, 202)
    assert.equal((await post(base, 'forgot-password', { email: testAccount.email })).status, 429)
    assert.equal((await post(base, 'reset-password', { token: 'x'.repeat(43), newPassword: nextPassword })).status, 400)
  }, { passwordResetLimit: { limit: 2, windowMs: 60000 } })
  await http(f, async base => {
    const res = await post(base, 'forgot-password', { email: testAccount.email }); assert.equal(res.status, 503)
    assert.equal((await res.text()).includes('private data'), false)
  }, { passwordResetService: f.makeResetService({ repository: { ...f.resetRepository, async enqueue() { throw new Error('private data') } } }) })
})
test('reset origin is configured, never a request Host, and requires HTTPS in production', () => {
  assert.equal(resetOrigin({ NODE_ENV: 'production' }), undefined)
  assert.equal(resetOrigin({ VERCEL_ENV: 'preview', VERCEL_URL: 'preview.vercel.app', NODE_ENV: 'production' }), 'https://preview.vercel.app')
  for (const value of ['http://evil.example', 'https://u:p@example.com', 'https://example.com/path', 'https://example.com?url=evil'])
    assert.throws(() => resetOrigin({ F2_PASSWORD_RESET_ORIGIN: value, NODE_ENV: 'production' }))
})
test('Resend is server-configured, accepts saved alias and sanitizes all provider errors', async () => {
  const config = { RESET_API_KEY: 're_private_test', F2_EMAIL_FROM: 'TemuEvent <onboarding@resend.dev>' }
  let calls = 0
  const mailer = resendMailer(config, async (url, init) => {
    calls++; assert.equal(url, 'https://api.resend.com/emails')
    assert.equal(new Headers(init?.headers).get('Idempotency-Key'), 'stable-key')
    const body = JSON.parse(String(init?.body)); assert.equal(body.from, config.F2_EMAIL_FROM); assert.deepEqual(body.to, ['person@example.test'])
    return Response.json({ id: 'accepted' })
  })!
  const message = { to: 'person@example.test', subject: 'Reset', text: 'test', html: '<p>test</p>', idempotencyKey: 'stable-key' }
  await mailer.send(message); assert.equal(calls, 1)
  assert.equal(resendMailer({}), undefined)
  assert.throws(() => resendMailer({ ...config, RESEND_API_KEY: 're_different' }))
  assert.throws(() => resendMailer({ ...config, F2_EMAIL_FROM: 'bad\r\nfrom' }))
  const denied = resendMailer(config, async () => Response.json({ message: 'private signup address' }, { status: 403 }))!
  await assert.rejects(denied.send(message), error => error instanceof MailDeliveryError && !error.message.includes('private'))
  const restricted = resendMailer({ ...config, F2_EMAIL_TEST_RECIPIENT: 'allowed@example.test' }, async () => { assert.fail('Must not send') })!
  await assert.rejects(restricted.send(message), MailDeliveryError)
})
