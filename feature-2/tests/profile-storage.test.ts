import assert from 'node:assert/strict'
import { test } from 'node:test'
import { supabaseProfileStorage } from '../server/profile/storage'

test('storage configuration is optional, backend-only and fails closed when partial or unsafe', () => {
  assert.equal(supabaseProfileStorage({}), undefined)
  assert.throws(() => supabaseProfileStorage({ SUPABASE_URL: 'https://example.supabase.co' }))
  assert.throws(() => supabaseProfileStorage({ SUPABASE_URL: 'http://example.test', SUPABASE_SECRET_KEY: 'test' }))
  assert.throws(() => supabaseProfileStorage({ SUPABASE_URL: 'https://example.test', SUPABASE_SECRET_KEY: 'test', F2_PROFILE_BUCKET: '../other' }))
})

test('SDK transport uses an immutable private object upload and authenticated download/delete', async () => {
  const calls: { url: string; init: RequestInit }[] = [], secret = 'sb_secret_test_value'
  const transport = (async (input, init: RequestInit = {}) => {
    calls.push({ url: String(input), init })
    if (init.method === 'GET') return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/webp' } })
    return new Response(JSON.stringify(init.method === 'DELETE' ? [] : { Key: 'profile-pictures/profiles/test/image.webp' }),
      { headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  const config = supabaseProfileStorage({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: secret }, transport)!
  await config.storage.upload('profiles/test/image.webp', Buffer.from('data'))
  assert.deepEqual(await config.storage.download('profiles/test/image.webp'), Buffer.from([1, 2, 3]))
  await config.storage.remove('profiles/test/image.webp')
  assert.equal(calls.length, 3)
  assert.equal(new Headers(calls[0].init.headers).get('x-upsert'), 'false')
  assert.equal(new Headers(calls[0].init.headers).get('content-type'), 'image/webp')
  for (const call of calls) {
    assert.equal(new Headers(call.init.headers).get('apikey'), secret)
    assert.equal(call.url.includes(secret), false)
    assert.equal(call.url.includes('/object/public/'), false)
  }
})
