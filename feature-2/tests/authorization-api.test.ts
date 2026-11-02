import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import express from 'express'
import type { Server } from 'node:http'
import { createApp } from '../server/app'
import { authentication, requireAuthentication, requireCsrf, requireRoles } from '../server/auth/authorization'
import { integerIdr } from '../server/organizer/read-repository'
import type { OrganizerReadRepository } from '../server/organizer/reads'
import { sessionFixture, loginFields, testAccount } from './helpers/sessions'

async function withServer(server: Server, work: (base: string) => Promise<void>) {
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing port')
  try { await work('http://127.0.0.1:' + address.port) }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
}
const cookieFor = (value: { accessToken: string; refreshToken: string }) =>
  'temuevent_access=' + value.accessToken + '; temuevent_refresh=' + value.refreshToken
const eventId = '44444444-4444-4444-8444-444444444444'
const otherEventId = '55555555-5555-4555-8555-555555555555'
const page = { page: 1, pageSize: 10, total: 0, totalPages: 0 }

function reads() {
  const calls: { operation: string; actor: string; page?: number; pageSize?: number }[] = []
  const repository: OrganizerReadRepository = {
    async listEvents(actor, p, size) {
      calls.push({ operation: 'events', actor, page: p, pageSize: size })
      return { items: [], pagination: { ...page, page: p, pageSize: size } }
    },
    async eventBelongsTo(actor, id) { calls.push({ operation: 'owner', actor }); return id === eventId && actor === testAccount.id },
    async listAttendees(actor) { calls.push({ operation: 'attendees', actor }); return { items: [], pagination: page } },
  }
  return { repository, calls }
}

test('protected identity rejects absent, forged, duplicate and demo-only identity', async () => {
  const f = sessionFixture()
  await withServer(createApp({ sessionService: f.service, now: f.now }).listen(0, '127.0.0.1'), async base => {
    for (const headers of [{}, { 'x-demo-persona': 'organizer', 'x-user-id': testAccount.id },
      { cookie: 'temuevent_access=forged.jwt.token' },
      { cookie: 'temuevent_access=one; temuevent_access=two' }]) {
      const response = await fetch(base + '/api/me', { headers: headers as Record<string, string> })
      assert.equal(response.status, 401)
      assert.equal(response.headers.get('cache-control'), 'no-store')
    }
  })
})

test('identity comes from the verified session and current user row, without secret fields', async () => {
  const f = sessionFixture(), value = await f.service.login(loginFields)
  await withServer(createApp({ sessionService: f.service, now: f.now }).listen(0, '127.0.0.1'), async base => {
    const response = await fetch(base + '/api/me', { headers: { cookie: cookieFor(value), 'x-demo-persona': 'organizer' } })
    const body = await response.json()
    assert.equal(response.status, 200)
    assert.deepEqual(body.data, value.user)
    assert.equal(body.data.role, 'CUSTOMER')
    assert.equal(JSON.stringify(body).includes('passwordHash'), false)
    f.users.get(testAccount.email)!.role = 'ORGANIZER'
    assert.equal((await (await fetch(base + '/api/me', { headers: { cookie: cookieFor(value) } })).json()).data.role, 'ORGANIZER')
    await f.service.logout(value.refreshToken)
    assert.equal((await fetch(base + '/api/me', { headers: { cookie: cookieFor(value) } })).status, 401)
  })
})

test('customer role cannot enter organizer routes, including with forged actor query/headers', async () => {
  const f = sessionFixture(), value = await f.service.login(loginFields), data = reads()
  await withServer(createApp({ sessionService: f.service, now: f.now, organizerRepository: data.repository }).listen(0, '127.0.0.1'), async base => {
    for (const path of ['/api/organizer/events?organizerId=someone-else', '/api/organizer/events/' + eventId + '/attendees']) {
      const response = await fetch(base + path, { headers: { cookie: cookieFor(value), 'x-demo-persona': 'organizer', 'x-role': 'ORGANIZER' } })
      assert.equal(response.status, 403)
      assert.equal((await response.json()).code, 'ROLE_FORBIDDEN')
    }
    assert.equal(data.calls.length, 0)
  })
})

test('organizer queries use the authenticated ID and hide missing/other-owner records equally', async () => {
  const f = sessionFixture(); f.users.get(testAccount.email)!.role = 'ORGANIZER'
  const value = await f.service.login(loginFields), data = reads()
  await withServer(createApp({ sessionService: f.service, now: f.now, organizerRepository: data.repository }).listen(0, '127.0.0.1'), async base => {
    const get = (path: string) => fetch(base + path, { headers: { cookie: cookieFor(value) } })
    assert.equal((await get('/api/organizer/events?page=2&pageSize=5')).status, 200)
    assert.deepEqual(data.calls[0], { operation: 'events', actor: testAccount.id, page: 2, pageSize: 5 })
    const own = await get('/api/organizer/events/' + eventId + '/attendees')
    assert.equal(own.status, 200)
    assert.deepEqual((await own.json()).data.items, [])
    const other = await get('/api/organizer/events/' + otherEventId + '/attendees')
    const missing = await get('/api/organizer/events/66666666-6666-4666-8666-666666666666/attendees')
    assert.equal(other.status, 404); assert.equal(missing.status, 404)
    assert.deepEqual(await other.json(), await missing.json())
    assert.equal(data.calls.filter(call => call.operation === 'attendees').length, 1)
  })
})

test('pagination and UUID validation reject invalid or caller-selected organizer inputs', async () => {
  const f = sessionFixture(); f.users.get(testAccount.email)!.role = 'ORGANIZER'
  const value = await f.service.login(loginFields), data = reads()
  await withServer(createApp({ sessionService: f.service, now: f.now, organizerRepository: data.repository }).listen(0, '127.0.0.1'), async base => {
    for (const path of ['/api/organizer/events?page=0', '/api/organizer/events?pageSize=51',
      '/api/organizer/events?organizerId=someone-else', '/api/organizer/events/123/attendees']) {
      assert.equal((await fetch(base + path, { headers: { cookie: cookieFor(value) } })).status, 400)
    }
    assert.equal(data.calls.length, 0)
  })
})

test('role middleware denies missing identity and supports either role explicitly', async () => {
  assert.throws(() => requireRoles())
  const f = sessionFixture(), value = await f.service.login(loginFields)
  const app = express()
  app.get('/missing', requireRoles('CUSTOMER'), (_req, res) => res.sendStatus(200))
  app.get('/customer', requireAuthentication(f.service, false), requireRoles('CUSTOMER'), (_req, res) => res.sendStatus(200))
  app.get('/either', requireAuthentication(f.service, false), requireRoles('CUSTOMER', 'ORGANIZER'), (_req, res) => res.sendStatus(200))
  await withServer(app.listen(0, '127.0.0.1'), async base => {
    assert.equal((await fetch(base + '/missing')).status, 401)
    assert.equal((await fetch(base + '/customer', { headers: { cookie: cookieFor(value) } })).status, 200)
    f.users.get(testAccount.email)!.role = 'ORGANIZER'
    assert.equal((await fetch(base + '/customer', { headers: { cookie: cookieFor(value) } })).status, 403)
    assert.equal((await fetch(base + '/either', { headers: { cookie: cookieFor(value) } })).status, 200)
  })
})

test('write guard binds CSRF to the authenticated session and permits multipart uploads', async () => {
  const f = sessionFixture(), first = await f.service.login(loginFields), second = await f.service.login(loginFields)
  const app = express()
  app.post('/write-check', requireAuthentication(f.service, false), requireRoles('CUSTOMER'),
    requireCsrf(f.service, false), (_req, res) => res.json({ userId: authentication(res)!.user.id }))
  await withServer(app.listen(0, '127.0.0.1'), async base => {
    const post = (cookie: string, csrf: string, client = 'web', site = 'same-origin') => fetch(base + '/write-check', {
      method: 'POST', headers: { cookie, 'x-csrf-token': csrf, 'x-temuevent-client': client,
        'sec-fetch-site': site, 'content-type': 'multipart/form-data; boundary=example' }, body: '--example--',
    })
    assert.equal((await post(cookieFor(first), first.csrfToken)).status, 200)
    assert.equal((await post(cookieFor(first), 'wrong')).status, 403)
    assert.equal((await post(cookieFor(first), first.csrfToken, '')).status, 403)
    assert.equal((await post(cookieFor(first), first.csrfToken, 'web', 'cross-site')).status, 403)
    const mixed = 'temuevent_access=' + first.accessToken + '; temuevent_refresh=' + second.refreshToken
    assert.equal((await post(mixed, second.csrfToken)).status, 403)
    await f.service.refresh(first.refreshToken)
    assert.equal((await post(cookieFor(first), first.csrfToken)).status, 403)
  })
})

test('protected HTTP errors sanitize configuration/database failures', async () => {
  await withServer(createApp().listen(0, '127.0.0.1'), async base => {
    assert.equal((await fetch(base + '/api/me')).status, 503)
  })
  const f = sessionFixture(); f.users.get(testAccount.email)!.role = 'ORGANIZER'
  const value = await f.service.login(loginFields), data = reads()
  data.repository.listEvents = async () => { throw new Error('private connection information') }
  await withServer(createApp({ sessionService: f.service, now: f.now, organizerRepository: data.repository }).listen(0, '127.0.0.1'), async base => {
    const response = await fetch(base + '/api/organizer/events', { headers: { cookie: cookieFor(value) } })
    assert.equal(response.status, 503)
    assert.equal(JSON.stringify(await response.json()).includes('private connection information'), false)
  })
})

test('IDR serialization refuses precision loss or negative amounts', () => {
  assert.equal(integerIdr(0n), 0)
  assert.equal(integerIdr(150000n), 150000)
  assert.throws(() => integerIdr(-1n))
  assert.throws(() => integerIdr(BigInt(Number.MAX_SAFE_INTEGER) + 1n))
})
