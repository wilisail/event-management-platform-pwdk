import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import { createApp, type AppOptions } from '../server/app'
import { sessionFixture, loginFields } from './helpers/sessions'

async function withServer(options: AppOptions, work: (base: string) => Promise<void>) {
  const server = createApp(options).listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing port')
  try { await work('http://127.0.0.1:' + address.port) }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
}
const request = (base: string, path: string, body: unknown = {}, headers: Record<string, string> = {}) =>
  fetch(base + '/api/auth/' + path, { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-temuevent-client': 'web', ...headers }, body: JSON.stringify(body) })
const cookies = (response: Response) => response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')

test('login HTTP returns protected cookies and safe fields; refresh rotates; replay revokes access', async () => {
  const f = sessionFixture()
  await withServer({ sessionService: f.service, now: f.now, secureCookies: false }, async base => {
    const login = await request(base, 'login', loginFields)
    const value = await login.json()
    assert.equal(login.status, 200)
    assert.equal(login.headers.get('cache-control'), 'no-store')
    assert.equal(value.data.user.email, loginFields.email)
    for (const secret of ['accessToken', 'refreshToken', 'passwordHash', loginFields.password]) {
      assert.equal(JSON.stringify(value).includes(secret), false)
    }
    assert.equal(login.headers.getSetCookie().length, 2)
    for (const header of login.headers.getSetCookie()) {
      assert.match(header, /HttpOnly/); assert.match(header, /SameSite=Lax/); assert.match(header, /Path=\//)
    }
    const originalCookie = cookies(login)
    const active = await fetch(base + '/api/auth/session', { headers: { cookie: originalCookie } })
    assert.equal(active.status, 200)
    const csrf = await fetch(base + '/api/auth/csrf', { headers: { cookie: originalCookie } })
    assert.equal((await csrf.json()).data.csrfToken, value.data.csrfToken)
    const withoutCsrf = await request(base, 'refresh', {}, { cookie: originalCookie })
    assert.equal(withoutCsrf.status, 403)
    const refreshed = await request(base, 'refresh', {}, { cookie: originalCookie, 'x-csrf-token': value.data.csrfToken })
    assert.equal(refreshed.status, 200)
    const next = await refreshed.json()
    assert.notEqual(next.data.csrfToken, value.data.csrfToken)
    const nextCookie = cookies(refreshed)
    assert.notEqual(nextCookie, originalCookie)
    const replay = await request(base, 'refresh', {}, { cookie: originalCookie, 'x-csrf-token': value.data.csrfToken })
    assert.equal(replay.status, 401)
    assert.equal((await fetch(base + '/api/auth/session', { headers: { cookie: nextCookie } })).status, 401)
  })
})

test('logout requires CSRF when cookies exist, clears cookies and invalidates the database session', async () => {
  const f = sessionFixture()
  await withServer({ sessionService: f.service, now: f.now }, async base => {
    const login = await request(base, 'login', loginFields)
    const body = await login.json(), cookie = cookies(login)
    assert.equal((await request(base, 'logout', {}, { cookie })).status, 403)
    const out = await request(base, 'logout', {}, { cookie, 'x-csrf-token': body.data.csrfToken })
    assert.equal(out.status, 200)
    assert(out.headers.getSetCookie().every(header => header.includes('Expires=Thu, 01 Jan 1970')))
    assert.equal((await fetch(base + '/api/auth/session', { headers: { cookie } })).status, 401)
    assert.equal((await request(base, 'logout')).status, 200)
  })
})

test('production cookies are host-only, Secure and prefixed; fake identity headers do not authenticate', async () => {
  const f = sessionFixture()
  await withServer({ sessionService: f.service, now: f.now, secureCookies: true }, async base => {
    const login = await request(base, 'login', loginFields)
    for (const header of login.headers.getSetCookie()) {
      assert.match(header, /^__Host-temuevent_/); assert.match(header, /; Secure/)
      assert.equal(header.includes('Domain='), false)
    }
    assert.equal((await fetch(base + '/api/auth/session', { headers: { 'x-demo-persona': 'organizer' } })).status, 401)
    const duplicate = cookies(login) + '; ' + login.headers.getSetCookie()[0].split(';')[0]
    assert.equal((await fetch(base + '/api/auth/session', { headers: { cookie: duplicate } })).status, 401)
  })
})

test('auth HTTP enforces origin/custom headers/JSON and supports explicit credentialed CORS', async () => {
  const f = sessionFixture()
  await withServer({ sessionService: f.service, now: f.now }, async base => {
    assert.equal((await request(base, 'login', loginFields, { origin: 'https://evil.example' })).status, 403)
    assert.equal((await request(base, 'login', loginFields, { 'sec-fetch-site': 'cross-site' })).status, 403)
    assert.equal((await fetch(base + '/api/auth/login', { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(loginFields) })).status, 403)
    assert.equal((await request(base, 'login', loginFields, { 'content-type': 'text/plain' })).status, 415)
    const preflight = await fetch(base + '/api/auth/login', { method: 'OPTIONS', headers: { origin: 'http://localhost:3001' } })
    assert.equal(preflight.status, 204)
    assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true')
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:3001')
    assert.match(preflight.headers.get('access-control-allow-headers')!, /x-csrf-token/)
    const invalid = await request(base, 'login', { ...loginFields, role: 'ORGANIZER' })
    assert.equal(invalid.status, 400)
    assert.equal((await request(base, 'refresh')).status, 401)
  })
})

test('login attempts are rate limited and auth availability never leaks private errors', async () => {
  const f = sessionFixture()
  await withServer({ sessionService: f.service, now: f.now, loginRateLimit: { limit: 2, windowMs: 60000 } }, async base => {
    for (let n = 0; n < 2; n++) assert.equal((await request(base, 'login', { ...loginFields, password: 'wrong' })).status, 401)
    const blocked = await request(base, 'login', loginFields)
    assert.equal(blocked.status, 429); assert(blocked.headers.get('retry-after'))
  })
  await withServer({}, async base => { assert.equal((await request(base, 'login', loginFields)).status, 503) })
  await withServer({ sessionService: { ...f.service, login: async () => { throw new Error('private connection') } } }, async base => {
    const response = await request(base, 'login', loginFields)
    assert.equal(response.status, 503)
    assert.equal(JSON.stringify(await response.json()).includes('private connection'), false)
  })
})
