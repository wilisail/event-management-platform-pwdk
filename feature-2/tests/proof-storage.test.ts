import assert from 'node:assert/strict'
import { test } from 'node:test'
import { supabasePaymentProofStorage } from '../server/organizer/proof-storage'
import { checkedPaymentProof, MAX_PAYMENT_PROOF_BYTES } from '../server/organizer/private-proof'

const env = { SUPABASE_URL: 'https://storage.example.test', SUPABASE_SECRET_KEY: 'test-only-storage-key' }
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
const bucket = { id: 'payment-proofs', name: 'payment-proofs', public: false,
  file_size_limit: MAX_PAYMENT_PROOF_BYTES, allowed_mime_types: ['image/png', 'image/jpeg'] }
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })

test('proof storage accepts only a server project origin and separate fixed bucket', () => {
  assert.equal(supabasePaymentProofStorage({}), undefined)
  assert.throws(() => supabasePaymentProofStorage({ SUPABASE_URL: env.SUPABASE_URL }))
  for (const url of ['http://storage.example.test', 'https://user:pass@storage.example.test', 'https://storage.example.test/path']) {
    assert.throws(() => supabasePaymentProofStorage({ ...env, SUPABASE_URL: url }))
  }
  assert.throws(() => supabasePaymentProofStorage({ ...env, F2_PAYMENT_PROOF_BUCKET: 'profile-pictures' }))
})

test('the private bounded proof is downloaded through backend authorization and returned as bytes', async () => {
  const paths: string[] = []
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(String(input)); paths.push(url.pathname)
    assert.equal(url.origin, env.SUPABASE_URL)
    assert.equal(new Headers(init?.headers).get('apikey'), env.SUPABASE_SECRET_KEY)
    if (url.pathname === '/storage/v1/bucket/payment-proofs') return json(bucket)
    assert.equal(url.pathname, '/storage/v1/object/payment-proofs/purchases/test-proof.png')
    return new Response(png, { headers: { 'content-type': 'image/png' } })
  }
  const adapter = supabasePaymentProofStorage(env, transport)!
  const file = await adapter.storage.read('purchases/test-proof.png')
  assert.deepEqual(checkedPaymentProof(file!).bytes, png)
  assert.equal(paths.length, 2)
  for (const key of ['https://other.example/proof.png', '../secret', 'purchases/../secret', 'purchases//file', 'proof?x=1']) {
    await assert.rejects(adapter.storage.read(key))
  }
  assert.equal(paths.length, 2)
})

test('public, unbounded or active-content buckets fail closed before a file request', async () => {
  for (const unsafe of [{ public: true }, { file_size_limit: null }, { file_size_limit: MAX_PAYMENT_PROOF_BYTES + 1 },
    { allowed_mime_types: ['image/svg+xml'] }]) {
    let calls = 0
    const adapter = supabasePaymentProofStorage(env, async () => { calls++; return json({ ...bucket, ...unsafe }) })!
    await assert.rejects(adapter.storage.read('purchases/proof.png'))
    assert.equal(calls, 1)
  }
})

test('proof provider failures and oversized objects never return a file', async () => {
  for (const response of [() => json({ message: 'private provider detail' }),
    () => new Response(new Uint8Array(MAX_PAYMENT_PROOF_BYTES + 1), { headers: { 'content-type': 'image/png' } })]) {
    const adapter = supabasePaymentProofStorage(env, async input =>
      String(input).includes('/bucket/') ? json(bucket) : response())!
    await assert.rejects(adapter.storage.read('purchases/proof.png'))
  }
})
