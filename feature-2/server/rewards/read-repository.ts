import type { PrismaClient } from '../../generated/prisma/client'
import type { RewardReadRepository } from './reads'
import { pointState, rewardCouponState, rewardInteger } from './reads'

export type RewardReadDatabase = Pick<PrismaClient, 'referral' | 'pointGrant' | 'rewardCoupon'>
export type RewardReadSnapshot = <T>(work: (db: RewardReadDatabase) => Promise<T>) => Promise<T>
const pagination = (page: number, pageSize: number, total: number) => ({
  page, pageSize, total, totalPages: Math.ceil(total / pageSize),
})

export function prismaRewardReadRepository(db: RewardReadDatabase, snapshot: RewardReadSnapshot): RewardReadRepository {
  return {
    countReferrals: userId => db.referral.count({ where: { referrerId: userId } }),
    wallet: (userId, asOf, query) => snapshot(async tx => {
      const validPoints = { userId, creditedAt: { lte: asOf }, expiresAt: { gt: asOf } }
      const availableCoupons = { userId, issuedAt: { lte: asOf }, expiresAt: { gt: asOf },
        redemptions: { none: { status: { in: ['RESERVED', 'CONSUMED'] as ('RESERVED' | 'CONSUMED')[] } } } }
      // Summary and both bounded history pages use the same repeatable-read snapshot.
      // The summary covers all valid rows, not only the currently displayed page.
      const [sum, availableCouponCount, grantCount, couponCount, grants, coupons] = await Promise.all([
        tx.pointGrant.aggregate({ where: validPoints, _sum: { remainingAmount: true } }),
        tx.rewardCoupon.count({ where: availableCoupons }),
        tx.pointGrant.count({ where: { userId } }),
        tx.rewardCoupon.count({ where: { userId } }),
        tx.pointGrant.findMany({ where: { userId }, take: query.pageSize,
          skip: (query.pointPage - 1) * query.pageSize, orderBy: [{ creditedAt: 'desc' }, { id: 'asc' }],
          select: { id: true, amount: true, remainingAmount: true, creditedAt: true, expiresAt: true } }),
        tx.rewardCoupon.findMany({ where: { userId }, take: query.pageSize,
          skip: (query.couponPage - 1) * query.pageSize, orderBy: [{ issuedAt: 'desc' }, { id: 'asc' }],
          select: { id: true, code: true, discountValue: true, issuedAt: true, expiresAt: true,
            redemptions: { where: { status: { in: ['RESERVED', 'CONSUMED'] } },
              select: { status: true }, take: 1 } } }),
      ])
      return {
        userId, asOf: asOf.toISOString(), currency: 'IDR', pointValueIdr: 1,
        availablePoints: rewardInteger(sum._sum.remainingAmount ?? 0n), availableCouponCount,
        pointGrants: { items: grants.map(grant => ({
          id: grant.id, amount: rewardInteger(grant.amount), remainingAmount: rewardInteger(grant.remainingAmount),
          creditedAt: grant.creditedAt.toISOString(), expiresAt: grant.expiresAt.toISOString(), status: pointState(grant, asOf),
        })), pagination: pagination(query.pointPage, query.pageSize, grantCount) },
        coupons: { items: coupons.map(coupon => ({
          id: coupon.id, code: coupon.code, discountType: 'FIXED_AMOUNT', discountValue: rewardInteger(coupon.discountValue),
          issuedAt: coupon.issuedAt.toISOString(), expiresAt: coupon.expiresAt.toISOString(), status: rewardCouponState(coupon, asOf),
        })), pagination: pagination(query.couponPage, query.pageSize, couponCount) },
      }
    }),
  }
}
