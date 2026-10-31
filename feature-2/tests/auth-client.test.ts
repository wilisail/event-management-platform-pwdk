import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AuthApiError, createAuthClient, safeReturnPath } from '../lib/auth-client'

const user = { id: 'test-user', name: 'Browser User', email: 'browser@example.test', role: 'CUSTOMER', referralCode: 'CODE', profilePictureUrl: null }
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 })
const denied = () => new Response(JSON.stringify({ success: false, code: 'SESSION_REQUIRED', message: 'Sign in' }), { status: 401 })
const transport = (work: (path: string, init: RequestInit) => Promise<Response> | Response) =>
  ((input: string | URL | Request, init: RequestInit = {}) => Promise.resolve(work(String(input), init))) as typeof fetch

test('return paths stay inside allowed account routes', () => {
  assert.equal(safeReturnPath('/organizer?page=2'), '/organizer?page=2')
  for (const path of ['https://evil.example', '//evil.example', '/\\evil.example', '/login', '/api/me', '/account\n', '/account/../login']) {
    assert.equal(safeReturnPath(path), '/account')
  }
  assert.equal(safeReturnPath(null, '/organizer'), '/organizer')
})

test('signup/login use JSON, application header and browser-managed cookies', async () => {
  const calls: { path: string; init: RequestInit }[] = []
  const client = createAuthClient({ fetcher: transport((path, init) => { calls.push({ path, init }); return ok({ user }) }) })
  await client.register({ name: user.name, email: user.email, password: 'long test passphrase' })
  assert.equal((await client.login({ email: user.email, password: 'long test passphrase' })).id, user.id)
  for (const call of calls) {
    assert.equal(call.init.method, 'POST'); assert.equal(call.init.credentials, 'include')
    assert.equal((call.init.headers as Record<string, string>)['x-temuevent-client'], 'web')
    assert.equal('cookie' in (call.init.headers as Record<string, string>), false)
  }
})

test('parallel protected GET failures share one refresh and retry once', async () => {
  let active = false, rotations = 0, locks = 0
  const client = createAuthClient({ coordinate: async work => { locks++; return work() }, fetcher: transport((path, init) => {
    if (path === '/api/auth/csrf') return ok({ csrfToken: 'csrf-current' })
    if (path === '/api/auth/refresh') {
      rotations++; assert.equal((init.headers as Record<string, string>)['x-csrf-token'], 'csrf-current')
      active = true; return ok({ user })
    }
    return active ? ok(user) : denied()
  }) })
  const results = await Promise.all([client.me(), client.get('/api/organizer/events')])
  assert.equal(results.length, 2); assert.equal(rotations, 1); assert.equal(locks, 1)
})

test('lock holder rechecks identity so another tab renewal does not rotate again', async () => {
  let active = false, rotations = 0
  const client = createAuthClient({ coordinate: async work => { active = true; return work() }, fetcher: transport(path => {
    if (path === '/api/auth/refresh') rotations++
    return active ? ok(user) : denied()
  }) })
  assert.equal((await client.me()).id, user.id)
  assert.equal(rotations, 0)
})

test('an uncertain refresh response is not retried automatically', async () => {
  let rotations = 0, uncertain = 0
  const client = createAuthClient({ coordinate: async work => work(), onUncertain: () => uncertain++, fetcher: transport(path => {
    if (path === '/api/auth/csrf') return ok({ csrfToken: 'csrf' })
    if (path === '/api/auth/refresh') { rotations++; throw new Error('lost response') }
    return denied()
  }) })
  await assert.rejects(client.me(), error => error instanceof AuthApiError && error.code === 'SESSION_REFRESH_UNCERTAIN')
  await assert.rejects(client.me(), error => error instanceof AuthApiError && error.status === 401)
  assert.equal(rotations, 1); assert.equal(uncertain, 1)
})

test('login failure and forbidden GET do not trigger refresh or replay writes', async () => {
  const calls: string[] = []
  const client = createAuthClient({ coordinate: async work => work(), fetcher: transport(path => {
    calls.push(path)
    return path.endsWith('/login') ? denied() : new Response(JSON.stringify({ success: false, code: 'ROLE_FORBIDDEN' }), { status: 403 })
  }) })
  await assert.rejects(client.login({ email: user.email, password: 'wrong' }))
  await assert.rejects(client.get('/api/organizer/events'))
  assert.deepEqual(calls, ['/api/auth/login', '/api/organizer/events'])
})

test('logout obtains current CSRF, runs once and never retries the mutation', async () => {
  const calls: string[] = []
  const client = createAuthClient({ coordinate: async work => work(), fetcher: transport((path, init) => {
    calls.push(path)
    if (path.endsWith('/csrf')) return ok({ csrfToken: 'fresh-csrf' })
    assert.equal((init.headers as Record<string, string>)['x-csrf-token'], 'fresh-csrf')
    return ok(null)
  }) })
  await client.logout()
  assert.deepEqual(calls, ['/api/auth/csrf', '/api/auth/logout'])
})

test('unsafe paths and HTML proxy errors remain controlled failures', async () => {
  const client = createAuthClient({ fetcher: transport(() => new Response('<html>error</html>', { status: 502 })) })
  await assert.rejects(client.get('https://elsewhere.example/api/me'), error => error instanceof AuthApiError && error.code === 'INVALID_API_PATH')
  await assert.rejects(client.me(), error => error instanceof AuthApiError && error.status === 502)
})
