import assert from 'node:assert/strict'
import { once } from 'node:events'
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { createApp, type AppOptions } from '../server/app'
import { createApp as createAccounts } from '../feature-2/server/app'
import { createAuthClient, AuthApiError } from '../feature-2/lib/auth-client'
import { sessionFixture, loginFields, testAccount } from '../feature-2/tests/helpers/sessions'

const owner = { ...testAccount, id: '22222222-2222-4222-8222-222222222222', email: 'owner@example.test', role: 'ORGANIZER' as const }
const other = { ...owner, id: '33333333-3333-4333-8333-333333333333', email: 'other@example.test' }
const eventInput = { name: 'Integrated event', category: 'Test', location: 'Jakarta', description: 'An integrated event',
  startAt: '2027-01-01T03:00:00Z', endAt: '2027-01-01T05:00:00Z', status: 'PUBLISHED',
  ticketTypes: [{ name: 'Regular', description: '', price: 75000, quota: 10 }] }

async function withApp(options: AppOptions, work: (base: string) => Promise<void>) {
  const fixture = sessionFixture()
  fixture.users.set(owner.email, owner); fixture.users.set(other.email, other)
  const accounts = createAccounts({ sessionService: fixture.service, secureCookies: false, now: fixture.now, fallthrough: true })
  const app = createApp({ sessionService: fixture.service, secureCookies: false, now: fixture.now, accountApi: accounts, ...options })
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert(address && typeof address !== 'string')
  try { await work(`http://127.0.0.1:${address.port}`) }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
}

async function login(base: string, email = owner.email) {
  const response = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-temuevent-client': 'web' }, body: JSON.stringify({ ...loginFields, email }) })
  assert.equal(response.status, 200)
  const body = await response.json()
  return { cookie: response.headers.getSetCookie().map(value => value.split(';')[0]).join('; '), csrf: body.data.csrfToken }
}
function write(base: string, session?: Awaited<ReturnType<typeof login>>, fields: unknown = eventInput, csrf = true) {
  return fetch(base + '/api/events', { method: 'POST', headers: { 'content-type': 'application/json', 'x-temuevent-client': 'web',
    ...(session ? { cookie: session.cookie, ...(csrf ? { 'x-csrf-token': session.csrf } : {}) } : {}) }, body: JSON.stringify(fields) })
}

test('one API serves public F1 reads and F2 login, and blocks unauthenticated/customer/CSRF event writes', async () => {
  let writes = 0
  await withApp({ eventsReader: async () => [], eventCreator: async () => { writes++; return { id: randomUUID() } } }, async base => {
    assert.equal((await fetch(base + '/api/events')).status, 200)
    const oversizedLogin = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-temuevent-client': 'web' }, body: JSON.stringify({ email: owner.email, password: 'a'.repeat(10000) }) })
    assert.equal(oversizedLogin.status, 413)
    assert.equal((await write(base)).status, 401)
    assert.equal((await write(base, await login(base, testAccount.email))).status, 403)
    const actor = await login(base)
    assert.equal((await write(base, actor, eventInput, false)).status, 403)
    assert.equal((await write(base, actor, { ...eventInput, organizerId: other.id })).status, 400)
    assert.equal((await write(base, actor, { ...eventInput, imagePublicId: 'someone-elses-image' })).status, 400)
    assert.equal(writes, 0)
    assert.equal((await write(base, actor)).status, 201)
    const logout = await fetch(base + '/api/auth/logout', { method: 'POST', headers: { cookie: actor.cookie, 'content-type': 'application/json', 'x-temuevent-client': 'web', 'x-csrf-token': actor.csrf }, body: '{}' })
    assert.equal(logout.status, 200)
    assert.equal((await write(base, actor)).status, 401)
    assert.equal(writes, 1)
  })
})

test('multipart creation derives the owner from the shared session, stores the server poster, and removes temporary files', async () => {
  let diskPath = '', calledOwner = '', written: unknown
  await withApp({ imageUploader: async (file, organizerId) => {
    diskPath = file.path; calledOwner = organizerId; assert(existsSync(file.path))
    return { secure_url: 'https://res.cloudinary.com/test/image/upload/poster.png', public_id: 'temuevent/events/' + organizerId + '/poster' }
  }, eventCreator: async input => { written = input; return { id: 'event-created' } } }, async base => {
    const session = await login(base), form = new FormData()
    form.append('event', JSON.stringify(eventInput)); form.append('image', new Blob(['test image'], { type: 'image/png' }), 'poster.png')
    const response = await fetch(base + '/api/events', { method: 'POST', headers: { cookie: session.cookie, 'x-temuevent-client': 'web', 'x-csrf-token': session.csrf }, body: form })
    assert.equal(response.status, 201)
    assert.equal(calledOwner, owner.id)
    assert.equal((written as { organizerId: string }).organizerId, owner.id)
    assert.equal((written as { imagePublicId: string }).imagePublicId, 'temuevent/events/' + owner.id + '/poster')
    assert.equal((await response.json()).data.id, 'event-created')
  })
  assert.equal(existsSync(diskPath), false)
})

test('failed creation cleans an unreferenced poster, preserves a committed poster, and does not expose provider errors', async () => {
  for (const referenced of [false, true, 'unknown'] as const) {
    let removed = 0
    await withApp({ imageUploader: async () => ({ secure_url: 'https://res.cloudinary.com/test/image/upload/new.png', public_id: 'new-test-poster' }),
      eventCreator: async () => { throw new Error('private database connection string') },
      imageInUse: async () => { if (referenced === 'unknown') throw new Error('private connection'); return referenced },
      imageRemover: async () => { removed++ },
    }, async base => {
      const session = await login(base), form = new FormData()
      form.append('event', JSON.stringify(eventInput)); form.append('image', new Blob(['test'], { type: 'image/png' }), 'poster.png')
      const response = await fetch(base + '/api/events', { method: 'POST', headers: { cookie: session.cookie, 'x-temuevent-client': 'web', 'x-csrf-token': session.csrf }, body: form })
      assert.equal(response.status, 503)
      assert.equal((await response.json()).code, 'EVENT_CREATION_UNCERTAIN')
      assert.equal(removed, referenced === false ? 1 : 0)
    })
  }
})

test('the browser client sends one authenticated multipart request and refuses a changed account before writing', async () => {
  let writes = 0, seenHeaders: Headers | undefined
  await withApp({ eventCreator: async input => { writes++; assert.equal(input.organizerId, owner.id); return { id: 'created-once' } } }, async base => {
    const session = await login(base)
    const client = createAuthClient({ fetcher: (path, init) => {
      const headers = new Headers(init?.headers); headers.set('cookie', session.cookie)
      if (String(path) === '/api/events') seenHeaders = headers
      return fetch(base + String(path), { ...init, headers })
    } })
    await assert.rejects(client.createEvent(eventInput, undefined, other.id), (error: unknown) => error instanceof AuthApiError && error.code === 'ACCOUNT_CHANGED')
    assert.equal(writes, 0)
    assert.deepEqual(await client.createEvent(eventInput, undefined, owner.id), { id: 'created-once' })
    assert.equal(writes, 1)
    assert.equal(seenHeaders?.get('x-temuevent-client'), 'web')
    assert.equal(seenHeaders?.get('x-csrf-token'), session.csrf)
  })
})

test('standalone image uploads and review writes stay closed until their supported flow is available', async () => {
  await withApp({}, async base => {
    const session = await login(base)
    const response = await fetch(base + '/api/uploads/event-image', { method: 'POST', headers: { cookie: session.cookie, 'x-temuevent-client': 'web', 'x-csrf-token': session.csrf } })
    assert.equal(response.status, 409)
    const buyer = await login(base, testAccount.email)
    const review = await fetch(base + '/api/events/' + randomUUID() + '/reviews', { method: 'POST', headers: { cookie: buyer.cookie, 'content-type': 'application/json', 'x-temuevent-client': 'web', 'x-csrf-token': buyer.csrf }, body: JSON.stringify({ rating: 5 }) })
    assert.equal(review.status, 503)
  })
})
