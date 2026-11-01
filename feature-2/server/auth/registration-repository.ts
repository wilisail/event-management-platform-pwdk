import type { PrismaClient } from '../../generated/prisma/client'
import { RegistrationError, type RegistrationRepository } from './registration'

export type RegistrationDatabase = Pick<PrismaClient, 'user' | 'referral' | 'pointGrant' | 'rewardCoupon'>
export type RegistrationTransaction = <T>(work: (database: RegistrationDatabase) => Promise<T>) => Promise<T>

export function prismaRegistrationRepository(
  database: RegistrationDatabase,
  transaction?: RegistrationTransaction,
): RegistrationRepository {
  return {
    findUserIdByEmail: email => database.user.findUnique({
      where: { email }, select: { id: true },
    }),
    async createUser(data, rewards) {
      const create = async (connection: RegistrationDatabase) => {
        const user = await connection.user.create({ data,
          select: { id: true, name: true, email: true, role: true, referralCode: true } })
        return { ...user, profilePictureUrl: null }
      }
      // A plain account is one atomic INSERT. Referral signup needs the provided boundary.
      if (!rewards) return create(database)
      if (!transaction) throw new RegistrationError(503, 'REFERRAL_REGISTRATION_UNAVAILABLE',
        'Referral registration is temporarily unavailable. No account was created.')
      return transaction(async tx => {
        const referrer = await tx.user.findUnique({ where: { referralCode: rewards.incomingCode }, select: { id: true } })
        if (!referrer) throw new RegistrationError(400, 'INVALID_REFERRAL_CODE',
          'The referral code was not found. No account was created.')
        const user = await create(tx)
        const referral = await tx.referral.create({ data: { referrerId: referrer.id, referredUserId: user.id } })
        await tx.pointGrant.create({ data: { referralId: referral.id, userId: referrer.id,
          amount: BigInt(rewards.points), remainingAmount: BigInt(rewards.points),
          creditedAt: rewards.issuedAt, expiresAt: rewards.expiresAt } })
        await tx.rewardCoupon.create({ data: { referralId: referral.id, userId: user.id,
          code: rewards.couponCode, discountValue: BigInt(rewards.couponValue),
          issuedAt: rewards.issuedAt, expiresAt: rewards.expiresAt } })
        return user
      })
    },
  }
}

