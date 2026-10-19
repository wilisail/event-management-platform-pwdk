import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import { createApp, type AppOptions } from '../server/app'

async function request(options: AppOptions) {
  const server = createApp(options).listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing port')
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/demo/database-check`)
    return { status: response.status, body: await response.json() }
  } finally {
    await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()))
  }
}

test('database diagnostic is absent from the default fixture API', async () => {
  assert.equal((await request({})).status, 404)
})

test('missing seed is distinguished from an unavailable database', async () => {
  const missing = await request({ databaseProbe: async () => null })
  assert.equal(missing.status, 404)
  assert.equal(missing.body.code, 'SEED_USER_NOT_FOUND')
  const unavailable = await request({ databaseProbe: async () => { throw new Error('private connection details') } })
  assert.equal(unavailable.status, 503)
  assert.equal(unavailable.body.code, 'DATABASE_UNAVAILABLE')
  assert.equal(JSON.stringify(unavailable.body).includes('private connection details'), false)
})
