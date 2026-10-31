import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { createRegistrationService, RegistrationError } from '../server/auth/registration'
import { memoryRegistration, registrationInput } from './helpers/registration'

const hasError = (code: string) => (error: unknown) =>
  error instanceof RegistrationError && error.code === code

test('registration normalizes email/name, preserves the password and generates a server-owned code', async () => {
  const memory = memoryRegistration()
  let passwordSeen = ''
  const service = createRegistrationService({
    repository: memory.repository,
    passwordHasher: async password => { passwordSeen = password; return 'test-only-hash' },
    referralCodeGenerator: () => 'A1B2C3D4E5F6',
  })
  const password = '  Long password with spaces  '
  const user = await service.register({ ...registrationInput, name: '  Ayu Test  ', email: ' TEST@Example.Test ', password })
  assert.equal(user.name, 'Ayu Test')
  assert.equal(user.email, 'test@example.test')
  assert.equal(user.role, 'CUSTOMER')
  assert.equal(user.referralCode, 'A1B2C3D4E5F6')
  assert.equal(passwordSeen, password)
  assert.equal('passwordHash' in user, false)
  assert.equal(memory.users.get(user.email)?.passwordHash, 'test-only-hash')
})

test('only the two project roles are valid during account creation', async () => {
  const memory = memoryRegistration()
  const service = createRegistrationService(memory)
  const organizer = await service.register({ ...registrationInput, role: 'ORGANIZER' })
  assert.equal(organizer.role, 'ORGANIZER')
  for (const role of ['ADMIN', 'OWNER', 'customer']) {
    await assert.rejects(service.register({ ...registrationInput, email: role + '@example.test', role }), hasError('INVALID_REGISTRATION'))
  }
})

test('invalid, oversized or unexpected fields are rejected before hashing or inserting', async () => {
  const memory = memoryRegistration()
  const service = createRegistrationService(memory)
  for (const input of [
    null, [], {}, { ...registrationInput, email: 'invalid' },
    { ...registrationInput, name: ' ' }, { ...registrationInput, password: 'short' },
    { ...registrationInput, password: ' '.repeat(20) },
    { ...registrationInput, password: 'x'.repeat(129) },
    { ...registrationInput, id: randomUUID() },
    { ...registrationInput, passwordHash: 'caller-chosen' },
  ]) await assert.rejects(service.register(input), hasError('INVALID_REGISTRATION'))
  assert.equal(memory.calls.hashes, 0)
  assert.equal(memory.calls.inserts, 0)
})

test('duplicate normalized email returns a conflict without another hash or insert', async () => {
  const memory = memoryRegistration()
  const service = createRegistrationService(memory)
  await service.register(registrationInput)
  await assert.rejects(service.register({ ...registrationInput, email: ' REGISTER@EXAMPLE.TEST ' }), hasError('EMAIL_IN_USE'))
  assert.equal(memory.calls.hashes, 1)
  assert.equal(memory.calls.inserts, 1)
  assert.equal(memory.users.size, 1)
})

test('a concurrent unique-email conflict is translated to the same public conflict', async () => {
  let exists = false
  const service = createRegistrationService({
    passwordHasher: async () => 'test-only-hash',
    repository: {
      findUserIdByEmail: async () => exists ? { id: 'other-request' } : null,
      createUser: async () => {
        exists = true
        throw Object.assign(new Error('Database details must remain private'), { code: 'P2002' })
      },
    },
  })
  await assert.rejects(service.register(registrationInput), hasError('EMAIL_IN_USE'))
})

test('a referral-code collision retries with a fresh code without repeating password hashing', async () => {
  const memory = memoryRegistration([{
    id: randomUUID(), name: 'Existing', email: 'existing@example.test',
    role: 'CUSTOMER', referralCode: 'ABCDEF123456', profilePictureUrl: null,
  }])
  let count = 0
  const service = createRegistrationService({
    ...memory, referralCodeGenerator: () => ++count === 1 ? 'ABCDEF123456' : '112233AABBCC',
  })
  const user = await service.register(registrationInput)
  assert.equal(user.referralCode, '112233AABBCC')
  assert.equal(memory.calls.inserts, 2)
  assert.equal(memory.calls.hashes, 1)
})

test('referral-code retries are bounded and unrelated failures are not retried', async () => {
  let attempts = 0
  const service = createRegistrationService({
    passwordHasher: async () => 'test-only-hash',
    repository: {
      findUserIdByEmail: async () => null,
      createUser: async () => {
        attempts++
        throw Object.assign(new Error('Collision'), { code: 'P2002' })
      },
    },
  })
  await assert.rejects(service.register(registrationInput), hasError('REFERRAL_CODE_UNAVAILABLE'))
  assert.equal(attempts, 3)
  const failure = new Error('Unavailable database')
  const failing = createRegistrationService({
    passwordHasher: async () => 'test-only-hash',
    repository: { findUserIdByEmail: async () => null, createUser: async () => { throw failure } },
  })
  await assert.rejects(failing.register(registrationInput), error => error === failure)
})

test('incoming referrals do not create accounts before their rewards can be committed atomically', async () => {
  const memory = memoryRegistration()
  const service = createRegistrationService(memory)
  await assert.rejects(service.register({ ...registrationInput, referralCode: 'AYU7K2P' }), hasError('REFERRAL_REGISTRATION_NOT_READY'))
  assert.equal(memory.calls.inserts, 0)
  assert.equal(memory.calls.hashes, 0)
  await service.register({ ...registrationInput, referralCode: '  ' })
  assert.equal(memory.users.size, 1)
})
