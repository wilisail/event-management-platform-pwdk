import assert from 'node:assert/strict'
import { once } from 'node:events'
import { after, before, test } from 'node:test'
import type { Server } from 'node:http'
import { createApp } from '../server/app'

let server: Server
let base: string
before(async () => {
  server = createApp({ now: () => new Date('2026-10-18T00:00:00.000Z') }).listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Server did not bind to a port')
  base = `http://127.0.0.1:${address.port}`
})
after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
})

test('identity requires an explicit demo persona and returns a consistent error', async () => {
  const response = await fetch(`${base}/api/demo/me`)
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), {
    success: false,
    code: 'DEMO_PERSONA_REQUIRED',
    message: 'Select customer or organizer using x-demo-persona',
  })
})
test('invalid persona cannot select an arbitrary user', async () => {
  const response = await fetch(`${base}/api/demo/me`, {
    headers: { 'x-demo-persona': 'administrator' },
  })
  assert.equal(response.status, 401)
})
test('customer checkout context exposes the proposed identity and wallet contract', async () => {
  const response = await fetch(`${base}/api/demo/checkout-context`, {
    headers: { 'x-demo-persona': 'customer' },
  })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.success, true)
  assert.equal(body.meta.mode, 'demo')
  assert.equal(body.data.user.role, 'CUSTOMER')
  assert.equal(body.data.rewards.availablePoints, 20000)
  assert.equal(body.data.rewards.currency, 'IDR')
  assert.equal('password' in body.data.user, false)
  assert.equal('passwordHash' in body.data.user, false)
})
test('organizer receives its own identity', async () => {
  const response = await fetch(`${base}/api/demo/me`, {
    headers: { 'x-demo-persona': 'organizer' },
  })
  const body = await response.json()
  assert.equal(body.data.role, 'ORGANIZER')
  assert.equal(body.data.id, 'demo-organizer-001')
})
test('organizer persona cannot use customer checkout or wallet routes', async () => {
  for (const path of ['/api/demo/me/rewards', '/api/demo/checkout-context']) {
    const response = await fetch(`${base}${path}`, { headers: { 'x-demo-persona': 'organizer' } })
    assert.equal(response.status, 403)
    assert.equal((await response.json()).code, 'CUSTOMER_REQUIRED')
  }
})
test('public organizer profile contains no private email or referral code', async () => {
  const response = await fetch(`${base}/api/demo/organizers/demo-organizer-001`)
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.data.ratingSummary, null)
  assert.equal('email' in body.data, false)
  assert.equal('referralCode' in body.data, false)
})
test('unknown organizer uses JSON 404 rather than an HTML error', async () => {
  const response = await fetch(`${base}/api/demo/organizers/not-real`)
  assert.equal(response.status, 404)
  assert.equal((await response.json()).code, 'ORGANIZER_NOT_FOUND')
})
test('F1 localhost origin can preflight the demo API', async () => {
  const response = await fetch(`${base}/api/demo/me`, {
    method: 'OPTIONS',
    headers: { origin: 'http://localhost:3000' },
  })
  assert.equal(response.status, 204)
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:3000')
  assert.match(response.headers.get('access-control-allow-headers') || '', /x-demo-persona/)
})
test('an unlisted origin receives a consistent 403 response', async () => {
  const response = await fetch(`${base}/api/demo/me`, {
    headers: { origin: 'https://unlisted.example', 'x-demo-persona': 'customer' },
  })
  assert.equal(response.status, 403)
  assert.equal((await response.json()).code, 'ORIGIN_NOT_ALLOWED')
})
test('write requests are not implemented in the read-only prototype', async () => {
  const response = await fetch(`${base}/api/demo/me`, { method: 'POST' })
  assert.equal(response.status, 404)
})
