import { randomUUID } from 'node:crypto'
import type { UserView } from '../../contracts/types'
import { RegistrationError, type NewAccount, type NewReferralRewards, type RegistrationRepository } from '../../server/auth/registration'

export const registrationInput = {
  name: 'Registration Test',
  email: 'register@example.test',
  password: 'A long registration test password',
}

export function memoryRegistration(initial: UserView[] = []) {
  const users = new Map<string, UserView & { passwordHash: string }>()
  for (const user of initial) users.set(user.email, { ...user, passwordHash: 'fixture-only' })
  const calls = { hashes: 0, inserts: 0 }
  const referrals: Array<{ id: string; referrerId: string; referredUserId: string }> = []
  const grants: Array<{ userId: string; referralId: string; amount: number; remainingAmount: number; creditedAt: Date; expiresAt: Date }> = []
  const coupons: Array<{ userId: string; referralId: string; code: string; discountValue: number; issuedAt: Date; expiresAt: Date }> = []
  const repository: RegistrationRepository = {
    async findUserIdByEmail(email) {
      const user = users.get(email)
      return user ? { id: user.id } : null
    },
    async createUser(data: NewAccount, rewards?: NewReferralRewards) {
      calls.inserts++
      if (users.has(data.email) || [...users.values()].some(u => u.referralCode === data.referralCode)) {
        throw Object.assign(new Error('Unique constraint'), { code: 'P2002' })
      }
      const row = { ...data, id: randomUUID(), profilePictureUrl: null }
      const referrer = rewards ? [...users.values()].find(user => user.referralCode === rewards.incomingCode) : undefined
      if (rewards && !referrer) throw new RegistrationError(400, 'INVALID_REFERRAL_CODE', 'Referral code not found')
      if (rewards && coupons.some(coupon => coupon.code === rewards.couponCode)) {
        throw Object.assign(new Error('Unique coupon code'), { code: 'P2002' })
      }
      // Atomic in-memory fixture. Actual rollback/constraints are checked against PostgreSQL.
      users.set(data.email, row)
      if (rewards && referrer) {
        const referral = { id: randomUUID(), referrerId: referrer.id, referredUserId: row.id }
        referrals.push(referral)
        grants.push({ userId: referrer.id, referralId: referral.id, amount: rewards.points,
          remainingAmount: rewards.points, creditedAt: rewards.issuedAt, expiresAt: rewards.expiresAt })
        coupons.push({ userId: row.id, referralId: referral.id, code: rewards.couponCode,
          discountValue: rewards.couponValue, issuedAt: rewards.issuedAt, expiresAt: rewards.expiresAt })
      }
      const { passwordHash: _privateHash, ...safe } = row
      return safe
    },
  }
  return {
    users, calls, referrals, grants, coupons, repository,
    passwordHasher: async (_password: string) => { calls.hashes++; return 'test-only-hash' },
  }
}

