import assert from 'node:assert/strict'
import { test } from 'node:test'
import { prismaRegistrationRepository, type RegistrationDatabase } from '../server/auth/registration-repository'
import { RegistrationError } from '../server/auth/registration'

const account = { name: 'Newcomer', email: 'new@example.test', role: 'CUSTOMER' as const,
  passwordHash: 'test-only-hash', referralCode: 'NEW123456789' }
const rewards = { incomingCode: 'INVITE123456', couponCode: 'REF-NEW', points: 10000, couponValue: 25000,
  issuedAt: new Date('2026-11-01T00:00:00Z'), expiresAt: new Date('2027-02-01T00:00:00Z') }

test('referral repository fails closed when no transaction boundary is configured', async () => {
  let writes = 0
  const database = { user: { create: () => { writes++; throw new Error('Unexpected write') } } } as unknown as RegistrationDatabase
  await assert.rejects(prismaRegistrationRepository(database).createUser(account, rewards), error =>
    error instanceof RegistrationError && error.code === 'REFERRAL_REGISTRATION_UNAVAILABLE')
  assert.equal(writes, 0)
})

test('all referral writes use the supplied transaction connection instead of the root client', async () => {
  const root = new Proxy({}, { get() { throw new Error('Root connection used outside transaction') } }) as RegistrationDatabase
  const calls: string[] = []
  const tx = {
    user: { findUnique: async () => ({ id: 'inviter' }), create: async () => {
      calls.push('user'); return { id: 'new-user', name: account.name, email: account.email, role: account.role, referralCode: account.referralCode }
    } },
    referral: { create: async () => { calls.push('referral'); return { id: 'referral' } } },
    pointGrant: { create: async ({ data }: { data: { userId: string; amount: bigint } }) => {
      calls.push('points'); assert.equal(data.userId, 'inviter'); assert.equal(data.amount, 10000n)
    } },
    rewardCoupon: { create: async ({ data }: { data: { userId: string; discountValue: bigint } }) => {
      calls.push('coupon'); assert.equal(data.userId, 'new-user'); assert.equal(data.discountValue, 25000n)
    } },
  } as unknown as RegistrationDatabase
  const result = await prismaRegistrationRepository(root, work => work(tx)).createUser(account, rewards)
  assert.equal(result.id, 'new-user')
  assert.deepEqual(calls, ['user', 'referral', 'points', 'coupon'])
})
