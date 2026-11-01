import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AuthApiError, createAuthClient, safeReturnPath } from '../lib/auth-client'

const user = { id: 'test-user', name: 'Browser User', email: 'browser@example.test', role: 'CUSTOMER', referralCode: 'CODE', profilePictureUrl: null }
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 })
const denied = () => new Response(JSON.stringify({ success: false, code: 'SESSION_REQUIRED', message: 'Sign in' }), { status: 401 })
const transport = (work: (path: string, init: RequestInit) => Promise<Response> | Response) =>
  ((input: string | URL | Request, init: RequestInit = {}) => Promise.resolve(work(String(input), init))) as typeof fetch

test('password changes use the mutation lock, current CSRF and exactly the two password fields', async () => {
  let locks = 0, changes = 0
  const client = createAuthClient({ coordinate: async work => { locks++; return work() }, fetcher: transport((path, init) => {
    if (path === '/api/auth/csrf') return ok({ csrfToken: 'csrf' })
    if (path === '/api/auth/password') {
      changes++; assert.deepEqual(JSON.parse(String(init.body)), { currentPassword: 'previous password', newPassword: 'next long password' })
      assert.equal(new Headers(init.headers).get('x-csrf-token'), 'csrf'); assert.equal(init.credentials, 'include')
      return ok({ signInRequired: true })
    }
    return ok(user)
  }) })
  await client.changePassword('previous password', 'next long password')
  assert.equal(changes, 1); assert.equal(locks, 1)
})

test('a lost password reply is never replayed and automatic refresh stays disabled until explicit sign-in', async () => {
  let changes = 0, rotations = 0, active = true
  const client = createAuthClient({ coordinate: async work => work(), fetcher: transport(path => {
    if (path === '/api/auth/csrf') return ok({ csrfToken: 'csrf' })
    if (path === '/api/auth/password') { changes++; active = false; throw new Error('lost after commit') }
    if (path === '/api/auth/refresh') rotations++
    return active ? ok(user) : denied()
  }) })
  await assert.rejects(client.changePassword('previous password', 'next long password'), { code: 'PASSWORD_CHANGE_UNCERTAIN' })
  await assert.rejects(client.me(), { status: 401 })
  assert.equal(changes, 1); assert.equal(rotations, 0)
})

test('an account switch while a password change waits cannot send the old form to the new account', async () => {
  let switched = false, writes = 0
  const client = createAuthClient({ coordinate: async work => { switched = true; return work() }, fetcher: transport((path, init) => {
    if (init.method === 'POST') writes++
    return ok(switched ? { ...user, id: 'another-account' } : user)
  }) })
  await assert.rejects(client.changePassword('previous password', 'next long password'), { code: 'ACCOUNT_CHANGED' })
  assert.equal(writes, 0)
})

test('profile writes obtain session CSRF and do not send caller-owned identity fields', async () => {
  const writes: RequestInit[] = []
  const client = createAuthClient({ coordinate: async work => work(), fetcher: transport((path, init) => {
    if (path === '/api/auth/csrf') return ok({ csrfToken: 'current-csrf' })
    if (init.method) { writes.push(init); return ok(user) }
    return ok(user)
  }) })
  await client.updateProfile('Updated Name')
  const file = new File(['image bytes'], 'profile.png', { type: 'image/png' })
  await client.uploadPicture(file)
  assert.equal(writes.length, 2)
  assert.deepEqual(JSON.parse(writes[0].body as string), { name: 'Updated Name' })
  assert.equal(writes[0].method, 'PATCH'); assert.equal(writes[1].body, file)
  for (const write of writes) {
    const headers = new Headers(write.headers)
    assert.equal(headers.get('x-csrf-token'), 'current-csrf')
    assert.equal(headers.get('x-temuevent-client'), 'web'); assert.equal(write.credentials, 'include')
  }
})

test('an uncertain profile write is never replayed automatically', async () => {
  let writes = 0
  const client = createAuthClient({ fetcher: transport((path, init) => {
    if (path === '/api/auth/csrf') return ok({ csrfToken: 'csrf' })
    if (init.method) { writes++; throw new Error('Lost response after save') }
    return ok(user)
  }) })
  await assert.rejects(client.updateProfile('New Name'), { code: 'PROFILE_SAVE_UNCERTAIN' })
  assert.equal(writes, 1)
})

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

test('password recovery is public and a lost reset reply is never replayed', async () => {
  const calls: string[] = []
  const client = createAuthClient({ fetcher: async (input, init) => {
    calls.push(String(input))
    assert.equal(new Headers(init?.headers).get('x-temuevent-client'), 'web')
    assert.equal(new Headers(init?.headers).has('x-csrf-token'), false)
    if (String(input).endsWith('forgot-password')) return Response.json({ success: true, data: null })
    throw new Error('reply lost')
  } })
  await client.requestPasswordReset('person@example.test')
  await assert.rejects(client.resetPassword('x'.repeat(43), 'a new long password'), { code: 'PASSWORD_RESET_UNCERTAIN' })
  assert.deepEqual(calls, ['/api/auth/forgot-password', '/api/auth/reset-password'])
})
