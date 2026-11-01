import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hashPassword, verifyPassword, PasswordWorkLimitError } from '../server/auth/passwords'

test('passwords have random salts, explicit costs and a verifiable one-way hash', async () => {
  const password = 'A sufficiently long passphrase 🔐'
  const first = await hashPassword(password)
  const second = await hashPassword(password)
  assert.match(first, /^scrypt-v1\$32768\$8\$3\$[a-f0-9]{32}\$[a-f0-9]{128}$/)
  assert.notEqual(first, second)
  assert.equal(first.includes(password), false)
  assert.equal(await verifyPassword(password, first), true)
  assert.equal(await verifyPassword(password + 'wrong', first), false)
})

test('password spaces are significant and malformed or unsupported hashes fail safely', async () => {
  const password = '  A long passphrase with spaces  '
  const hash = await hashPassword(password)
  assert.equal(await verifyPassword(password, hash), true)
  assert.equal(await verifyPassword(password.trim(), hash), false)
  for (const invalid of ['', 'plaintext', hash.replace('$32768$', '$999999999$'), hash + '$extra']) {
    assert.equal(await verifyPassword(password, invalid), false)
  }
})

test('hashing work is bounded instead of starting unlimited memory-heavy jobs', async () => {
  const pending = [hashPassword('Long concurrent password one'), hashPassword('Long concurrent password two')]
  await assert.rejects(hashPassword('Long concurrent password three'), PasswordWorkLimitError)
  await Promise.all(pending)
  assert.equal(await verifyPassword('wrong', await hashPassword('Another long password')), false)
})
