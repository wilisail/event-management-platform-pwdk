import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import { createApp, type AppOptions } from '../server/app'

const secret = 'ab'.repeat(32)

async function withApp(options: AppOptions, check: (base: string) => Promise<void>) {
  const server = createApp(options).listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected a TCP port')
  try { await check(`http://127.0.0.1:${address.port}`) }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
}

test('the scheduler requires a server secret and invokes only the configured queues', async () => {
  let calls = 0
  await withApp({ scheduledEmailJobs: { secret, passwordReset: async () => { calls++; return true }, decisionEmails: null } }, async base => {
    const url = base + '/api/internal/jobs/run'
    const call = (token?: string, query = '') => fetch(url + query, {
      method: 'POST', headers: token ? { Authorization: 'Bearer ' + token } : {},
    })
    assert.equal((await fetch(url)).status, 404)
    assert.equal((await call()).status, 401)
    assert.equal((await call('ba'.repeat(32))).status, 401)
    assert.equal((await call(secret, '?unexpected=1')).status, 400)
    assert.equal(calls, 0)
    const result = await call(secret)
    assert.equal(result.status, 200)
    assert.equal(result.headers.get('cache-control'), 'no-store')
    const { durationMs, ...outcome } = await result.json()
    assert(durationMs >= 0)
    assert.deepEqual(outcome, { success: true, passwordReset: true, decisionEmails: null })
    assert.equal(calls, 1)
  })
})

test('a queue scan failure is visible to the scheduler without leaking error details', async () => {
  await withApp({ scheduledEmailJobs: { secret, passwordReset: async () => true, decisionEmails: async () => false } }, async base => {
    const result = await fetch(base + '/api/internal/jobs/run', { method: 'POST', headers: { Authorization: 'Bearer ' + secret } })
    assert.equal(result.status, 503)
    const { durationMs, ...outcome } = await result.json()
    assert(durationMs >= 0)
    assert.deepEqual(outcome, { success: false, passwordReset: true, decisionEmails: false })
  })
})

test('readiness fails closed and keeps the database error out of the response', async () => {
  let fail = true
  await withApp({ checkReadiness: async () => { if (fail) throw new Error('private database detail') } }, async base => {
    assert.equal((await fetch(base + '/api/internal/jobs/run', { method: 'POST' })).status, 404)
    assert.equal((await fetch(base + '/api/health')).status, 200)
    const unavailable = await fetch(base + '/api/ready')
    assert.equal(unavailable.status, 503)
    assert.deepEqual(await unavailable.json(), { ready: false })
    fail = false
    const ready = await fetch(base + '/api/ready')
    assert.equal(ready.status, 200)
    assert.deepEqual(await ready.json(), { ready: true })
  })
})
