import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import { createApp, type AppOptions } from '../server/app'
import { createRegistrationService } from '../server/auth/registration'
import { memoryRegistration, registrationInput } from './helpers/registration'

async function withServer(options: AppOptions, work: (base: string) => Promise<void>) {
  const server = createApp(options).listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing server address')
  try { await work('http://127.0.0.1:' + address.port) }
  finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
}

const post = (base: string, input: unknown) => fetch(base + '/api/auth/register', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input),
})
const service = () => createRegistrationService(memoryRegistration())

test('registration is explicitly unavailable without a configured database service', async () => {
  await withServer({}, async base => {
    const response = await post(base, registrationInput)
    assert.equal(response.status, 503)
    assert.equal((await response.json()).code, 'REGISTRATION_UNAVAILABLE')
  })
})

test('successful registration returns a safe 201 identity and does not issue a login cookie', async () => {
  await withServer({ registrationService: service() }, async base => {
    const response = await post(base, registrationInput)
    const body = await response.json()
    assert.equal(response.status, 201)
    assert.equal(body.success, true)
    assert.equal(body.data.user.role, 'CUSTOMER')
    assert.match(body.data.user.referralCode, /^[0-9A-F]{12}$/)
    assert.equal(response.headers.get('set-cookie'), null)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(JSON.stringify(body).includes(registrationInput.password), false)
    assert.equal(JSON.stringify(body).includes('test-only-hash'), false)
    assert.deepEqual(Object.keys(body.data.user).sort(),
      ['id', 'name', 'email', 'role', 'referralCode', 'profilePictureUrl'].sort())
  })
})

test('the response boundary excludes accidental internal repository fields', async () => {
  await withServer({ registrationService: { register: async () => ({
    id: 'test-id', name: 'Test', email: 'test@example.test', role: 'CUSTOMER',
    referralCode: 'AABBCCDDEEFF', profilePictureUrl: null, passwordHash: 'private-hash',
  }) } }, async base => {
    const body = await (await post(base, registrationInput)).json()
    assert.equal(JSON.stringify(body).includes('private-hash'), false)
  })
})

test('normalized duplicate emails return JSON 409', async () => {
  await withServer({ registrationService: service() }, async base => {
    assert.equal((await post(base, registrationInput)).status, 201)
    const response = await post(base, { ...registrationInput, email: ' REGISTER@EXAMPLE.TEST ' })
    assert.equal(response.status, 409)
    assert.equal((await response.json()).code, 'EMAIL_IN_USE')
  })
})

test('invalid input and incoming referrals create no account and return useful codes', async () => {
  const memory = memoryRegistration()
  await withServer({ registrationService: createRegistrationService(memory) }, async base => {
    for (const input of [{ ...registrationInput, role: 'ADMIN' }, { ...registrationInput, password: 'short' }]) {
      const response = await post(base, input)
      assert.equal(response.status, 400)
      assert.equal((await response.json()).code, 'INVALID_REGISTRATION')
    }
    const response = await post(base, { ...registrationInput, referralCode: 'AYU7K2P' })
    assert.equal(response.status, 400)
    assert.equal((await response.json()).code, 'REFERRAL_REGISTRATION_NOT_READY')
    assert.equal(memory.users.size, 0)
  })
})

test('JSON parsing, content type and payload-size errors remain sanitized JSON responses', async () => {
  await withServer({ registrationService: service() }, async base => {
    const wrongType = await fetch(base + '/api/auth/register', { method: 'POST', body: 'name=test' })
    assert.equal(wrongType.status, 415)
    const malformed = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"password":',
    })
    assert.equal(malformed.status, 400)
    assert.equal((await malformed.json()).code, 'INVALID_JSON')
    const large = await post(base, { ...registrationInput, name: 'x'.repeat(10000) })
    assert.equal(large.status, 413)
    assert.equal((await large.json()).code, 'REQUEST_TOO_LARGE')
  })
})

test('allowed browser origins can preflight POST while unlisted origins are denied', async () => {
  await withServer({ registrationService: service() }, async base => {
    const preflight = await fetch(base + '/api/auth/register', {
      method: 'OPTIONS', headers: { origin: 'http://localhost:3000' },
    })
    assert.equal(preflight.status, 204)
    assert.match(preflight.headers.get('access-control-allow-methods') || '', /POST/)
    const forbidden = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { origin: 'https://unlisted.example', 'content-type': 'application/json' },
      body: JSON.stringify(registrationInput),
    })
    assert.equal(forbidden.status, 403)
  })
})

test('registration attempts are rate limited with a retry header', async () => {
  await withServer({
    registrationService: service(), registrationRateLimit: { limit: 2, windowMs: 60000 },
  }, async base => {
    assert.equal((await post(base, { ...registrationInput, email: 'first@example.test' })).status, 201)
    assert.equal((await post(base, { ...registrationInput, email: 'second@example.test' })).status, 201)
    const blocked = await post(base, { ...registrationInput, email: 'third@example.test' })
    assert.equal(blocked.status, 429)
    assert.equal((await blocked.json()).code, 'REGISTRATION_RATE_LIMITED')
    assert(blocked.headers.get('retry-after'))
  })
})

test('unexpected database errors never expose connection details', async () => {
  await withServer({ registrationService: { register: async () => {
    throw new Error('private database connection')
  } } }, async base => {
    const response = await post(base, registrationInput)
    assert.equal(response.status, 503)
    assert.equal(JSON.stringify(await response.json()).includes('private database connection'), false)
  })
})
