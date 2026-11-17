import type { CouponView, PointGrant, RewardCoupon, WalletView } from '../contracts/types'

export const REFERRAL_AWARD_POINTS = 10_000
export const REWARD_VALIDITY_MONTHS = 3

/** Calendar-month arithmetic in UTC, clamped to the target month's final day. */
export function addCalendarMonths(value: Date, months: number): Date {
  if (!Number.isFinite(value.getTime()) || !Number.isInteger(months)) {
    throw new TypeError('A valid date and an integer month count are required')
  }
  const result = new Date(value)
  const originalDay = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + months)
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate()
  result.setUTCDate(Math.min(originalDay, lastDay))
  return result
}

export function makeReferralGrant(id: string, userId: string, creditedAt: Date): PointGrant {
  return {
    id,
    userId,
    amount: REFERRAL_AWARD_POINTS,
    remainingAmount: REFERRAL_AWARD_POINTS,
    creditedAt: creditedAt.toISOString(),
    expiresAt: addCalendarMonths(creditedAt, REWARD_VALIDITY_MONTHS).toISOString(),
    source: 'REFERRAL',
  }
}

export function couponStatus(coupon: RewardCoupon, asOf: Date): CouponView['status'] {
  if (coupon.usedAt) return 'USED'
  return new Date(coupon.expiresAt).getTime() > asOf.getTime() ? 'AVAILABLE' : 'EXPIRED'
}

export function walletFor(
  userId: string,
  grants: readonly PointGrant[],
  coupons: readonly RewardCoupon[],
  asOf: Date,
): WalletView {
  const ownGrants = grants.filter((grant) => grant.userId === userId).map((grant) => ({ ...grant }))
  const availablePoints = ownGrants.reduce((sum, grant) => {
    if (new Date(grant.creditedAt).getTime() > asOf.getTime()) return sum
    if (new Date(grant.expiresAt).getTime() <= asOf.getTime()) return sum
    return sum + Math.max(0, grant.remainingAmount)
  }, 0)
  return {
    userId,
    asOf: asOf.toISOString(),
    currency: 'IDR',
    availablePoints,
    pointValueIdr: 1,
    pointGrants: ownGrants,
    coupons: coupons
      .filter((coupon) => coupon.userId === userId)
      .map((coupon) => ({ ...coupon, status: couponStatus(coupon, asOf) })),
    policy: { referralAwardPoints: 10000, validityCalendarMonths: 3, couponAmountIsDemo: true },
  }
}
