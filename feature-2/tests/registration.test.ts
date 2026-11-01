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
    { ...registrationInput, rewardPoints: 999999 },
    { ...registrationInput, referralCode: 'INVALID CODE' },
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

test('unknown referrals create no account/rewards, while an empty referral remains optional', async () => {
  const memory = memoryRegistration()
  const service = createRegistrationService(memory)
  await assert.rejects(service.register({ ...registrationInput, referralCode: 'UNKNOWN123' }), hasError('INVALID_REFERRAL_CODE'))
  assert.equal(memory.users.size, 0)
  assert.equal(memory.grants.length, 0)
  assert.equal(memory.coupons.length, 0)
  await service.register({ ...registrationInput, referralCode: '  ' })
  assert.equal(memory.users.size, 1)
})

const inviter = () => ({ id: randomUUID(), name: 'Inviter', email: 'inviter@example.test',
  role: 'CUSTOMER' as const, referralCode: 'INVITE123456', profilePictureUrl: null })

test('valid referral is normalized and awards the correct two recipients without exposing rewards/private fields', async () => {
  const owner = inviter(), memory = memoryRegistration([owner])
  const service = createRegistrationService(memory)
  const user = await service.register({ ...registrationInput, referralCode: '  invite123456  ' })
  assert.equal(memory.referrals[0].referrerId, owner.id)
  assert.equal(memory.referrals[0].referredUserId, user.id)
  assert.equal(memory.grants[0].userId, owner.id)
  assert.equal(memory.grants[0].amount, 10000)
  assert.equal(memory.grants[0].remainingAmount, 10000)
  assert.equal(memory.coupons[0].userId, user.id)
  assert.equal(memory.coupons[0].discountValue, 25000)
  assert.notEqual(user.referralCode, owner.referralCode)
  assert.equal('passwordHash' in user, false)
  assert.equal('rewards' in user, false)
})

test('three-month expiry clamps month ends and coupon configuration applies only to new issuance', async () => {
  const memory = memoryRegistration([inviter()]), at = new Date('2026-01-31T12:00:00.000Z')
  const first = createRegistrationService({ ...memory, now: () => at, referralCouponIdr: 7500 })
  await first.register({ ...registrationInput, referralCode: 'INVITE123456' })
  assert.equal(memory.grants[0].creditedAt.toISOString(), at.toISOString())
  assert.equal(memory.grants[0].expiresAt.toISOString(), '2026-04-30T12:00:00.000Z')
  assert.equal(memory.coupons[0].expiresAt.toISOString(), '2026-04-30T12:00:00.000Z')
  await createRegistrationService({ ...memory, referralCouponIdr: 12000 }).register({
    ...registrationInput, email: 'second@example.test', referralCode: 'INVITE123456',
  })
  assert.deepEqual(memory.coupons.map(coupon => coupon.discountValue), [7500, 12000])
})

test('parallel duplicate signup attempts issue one referral and one pair of rewards', async () => {
  const memory = memoryRegistration([inviter()]), service = createRegistrationService(memory)
  const input = { ...registrationInput, referralCode: 'INVITE123456' }
  const results = await Promise.allSettled([service.register(input), service.register(input)])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  const rejected = results.find(result => result.status === 'rejected') as PromiseRejectedResult
  assert.equal(rejected.reason.code, 'EMAIL_IN_USE')
  assert.equal(memory.users.size, 2)
  assert.equal(memory.referrals.length, 1)
  assert.equal(memory.grants.length, 1)
  assert.equal(memory.coupons.length, 1)
})

test('coupon code collisions retry a fresh bundle without another hash or duplicate award', async () => {
  const memory = memoryRegistration([inviter()])
  await createRegistrationService({ ...memory, couponCodeGenerator: () => 'REF-EXISTING' }).register({
    ...registrationInput, referralCode: 'INVITE123456',
  })
  let tries = 0
  await createRegistrationService({ ...memory, couponCodeGenerator: () => ++tries === 1 ? 'REF-EXISTING' : 'REF-FRESH' }).register({
    ...registrationInput, email: 'next@example.test', referralCode: 'INVITE123456',
  })
  assert.equal(tries, 2)
  assert.equal(memory.calls.hashes, 2)
  assert.equal(memory.users.size, 3)
  assert.equal(memory.grants.length, 2)
  assert.deepEqual(memory.coupons.map(coupon => coupon.code), ['REF-EXISTING', 'REF-FRESH'])
})

test('coupon value rejects invalid configuration rather than silently issuing an unusable reward', () => {
  for (const referralCouponIdr of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => createRegistrationService({ ...memoryRegistration(), referralCouponIdr }), RangeError)
  }
})

