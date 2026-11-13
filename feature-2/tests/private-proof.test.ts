import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import { createApp, type AppOptions } from '../server/app'
import { checkedPaymentProof, MAX_PAYMENT_PROOF_BYTES, type OrganizerProofReader } from '../server/organizer/private-proof'
import type { OrganizerReadRepository } from '../server/organizer/reads'
import { sessionFixture, loginFields, testAccount } from './helpers/sessions'

const purchaseId = '44444444-4444-4444-8444-444444444444'
const missingId = '55555555-5555-4555-8555-555555555555'
const ownerId = '22222222-2222-4222-8222-222222222222'
const otherId = '33333333-3333-4333-8333-333333333333'
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
const emptyPage = { items: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }

async function fixture(extra: Partial<AppOptions> = {}) {
  const auth = sessionFixture()
  const owner = { ...testAccount, id: ownerId, email: 'proof-owner@example.test', role: 'ORGANIZER' as const }
  const other = { ...owner, id: otherId, email: 'proof-other@example.test' }
  auth.users.set(owner.email, owner); auth.users.set(other.email, other)
  const logins = await Promise.all([owner, other, testAccount].map(user => auth.service.login({ ...loginFields, email: user.email })))
  const cookies = logins.map(login => `temuevent_access=${login.accessToken}; temuevent_refresh=${login.refreshToken}`)
  let uploaded = true
  const repository: OrganizerReadRepository = {
    async listEvents() { return emptyPage }, async eventBelongsTo() { return false }, async listAttendees() { return emptyPage },
    transactions: {
      async list() { return emptyPage }, async decisionState() { return null },
      async detail(actor, id) {
        if (actor !== ownerId || id !== purchaseId) return null
        return { id, reference: 'QA-PROOF', eventName: 'QA event', customerName: 'QA buyer',
          status: 'WAITING_FOR_ADMIN_CONFIRMATION', totalPrice: 10000, createdAt: auth.now().toISOString(),
          subtotal: 10000, voucherDiscount: 0, couponDiscount: 0, pointsUsed: 0,
          paymentDueAt: null, decisionDueAt: null, completedAt: null,
          proofUploadedAt: uploaded ? auth.now().toISOString() : null, items: [] }
      },
    },
  }
  const server = createApp({ secureCookies: false, sessionService: auth.service, organizerRepository: repository,
    now: auth.now, ...extra }).listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing test port')
  const base = `http://127.0.0.1:${address.port}/api/organizer/transactions`
  return { base, cookies, setUploaded(value: boolean) { uploaded = value },
    close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
}

test('private proof validates content type, file signature and size before delivery', () => {
  assert.equal(checkedPaymentProof({ bytes: png, contentType: 'image/png; charset=binary' }).contentType, 'image/png')
  assert.equal(checkedPaymentProof({ bytes: Buffer.from([255, 216, 255, 224]), contentType: 'image/jpeg' }).filename, 'bukti-pembayaran.jpg')
  for (const file of [
    { bytes: png, contentType: 'text/html' }, { bytes: Buffer.from('<script>bad()</script>'), contentType: 'image/png' },
    { bytes: new Uint8Array(), contentType: 'image/png' },
    { bytes: new Uint8Array(MAX_PAYMENT_PROOF_BYTES + 1), contentType: 'image/png' },
  ]) assert.throws(() => checkedPaymentProof(file), /Invalid proof file/)
})

test('owning Organizer receives private bytes with restrictive headers and no redirect', async () => {
  const calls: string[][] = []
  const f = await fixture({ organizerProofReader: async (actor, id) => {
    calls.push([actor, id]); return { bytes: png, contentType: 'image/png' }
  } })
  try {
    const response = await fetch(`${f.base}/${purchaseId}/proof`, { headers: { cookie: f.cookies[0] }, redirect: 'manual' })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'image/png')
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    assert.match(response.headers.get('content-security-policy')!, /sandbox/)
    assert.match(response.headers.get('content-disposition')!, /bukti-pembayaran\.png/)
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
    assert.equal(response.headers.get('location'), null)
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), png)
    assert.deepEqual(calls, [[ownerId, purchaseId]])
  } finally { await f.close() }
})

test('proof denies anonymous, Customer and other Organizer before reaching file storage', async () => {
  let reads = 0
  const f = await fixture({ organizerProofReader: async () => { reads++; return { bytes: png, contentType: 'image/png' } } })
  try {
    assert.equal((await fetch(`${f.base}/${purchaseId}/proof`, { headers: { 'x-demo-persona': 'organizer' } })).status, 401)
    assert.equal((await fetch(`${f.base}/${purchaseId}/proof`, { headers: { cookie: f.cookies[2] } })).status, 403)
    const foreign = await fetch(`${f.base}/${purchaseId}/proof`, { headers: { cookie: f.cookies[1] } })
    const missing = await fetch(`${f.base}/${missingId}/proof`, { headers: { cookie: f.cookies[0] } })
    assert.equal(foreign.status, 404); assert.equal(missing.status, 404)
    assert.deepEqual(await foreign.json(), await missing.json())
    assert.equal(reads, 0)
  } finally { await f.close() }
})

test('proof query/header forgery, invalid IDs and records without an upload are rejected', async () => {
  let reads = 0
  const f = await fixture({ organizerProofReader: async () => { reads++; return { bytes: png, contentType: 'image/png' } } })
  try {
    const get = (path: string) => fetch(f.base + path, { headers: { cookie: f.cookies[0], 'x-user-id': otherId } })
    assert.equal((await get(`/${purchaseId}/proof?organizerId=${ownerId}`)).status, 400)
    assert.equal((await get('/not-a-uuid/proof')).status, 400)
    f.setUploaded(false)
    assert.equal((await get(`/${purchaseId}/proof`)).status, 404)
    assert.equal(reads, 0)
  } finally { await f.close() }
})

test('unconnected proof storage fails closed and detail reports unavailable', async () => {
  const f = await fixture()
  try {
    const headers = { cookie: f.cookies[0] }
    assert.equal((await fetch(`${f.base}/${purchaseId}/proof`, { headers })).status, 503)
    assert.equal((await (await fetch(`${f.base}/${purchaseId}`, { headers })).json()).data.proofAvailability, 'UNAVAILABLE')
    f.setUploaded(false)
    assert.equal((await (await fetch(`${f.base}/${purchaseId}`, { headers })).json()).data.proofAvailability, 'NONE')
  } finally { await f.close() }
})

test('missing, invalid and failed proof reads return safe errors without object keys', async () => {
  const key = 'backend-private-object-key-never-expose'
  const cases: { reader: OrganizerProofReader; status: number }[] = [
    { reader: async () => null, status: 404 },
    { reader: async () => { throw new Error(key) }, status: 503 },
    { reader: async () => ({ bytes: Buffer.from('<html>bad</html>'), contentType: 'image/png' }), status: 503 },
  ]
  for (const item of cases) {
    const f = await fixture({ organizerProofReader: item.reader })
    try {
      const response = await fetch(`${f.base}/${purchaseId}/proof`, { headers: { cookie: f.cookies[0] } })
      assert.equal(response.status, item.status)
      assert.match(response.headers.get('cache-control')!, /no-store/)
      assert.equal((await response.text()).includes(key), false)
    } finally { await f.close() }
  }
})

test('ordinary application exposes no QA persona login or captured mailbox', async () => {
  const f = await fixture()
  try {
    assert.equal((await fetch(new URL('/api/qa/overview', f.base))).status, 404)
    assert.equal((await fetch(new URL('/api/qa/enter/organizer', f.base), {
      method: 'POST', headers: { 'x-temuevent-client': 'web' },
    })).status, 404)
  } finally { await f.close() }
})
