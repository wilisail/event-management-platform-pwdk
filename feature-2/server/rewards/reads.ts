import type { AccountWalletView } from '../../contracts/types'

export interface WalletQuery { pointPage: number; couponPage: number; pageSize: number }

export interface RewardReadRepository {
  wallet(userId: string, asOf: Date, query: WalletQuery): Promise<AccountWalletView>
  countReferrals(userId: string): Promise<number>
}

export function rewardInteger(amount: bigint): number {
  if (amount < 0n || amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Reward amount outside safe JSON range')
  }
  return Number(amount)
}

export function pointState(grant: { creditedAt: Date; expiresAt: Date; remainingAmount: bigint }, asOf: Date) {
  if (grant.creditedAt > asOf) return 'PENDING' as const
  if (grant.expiresAt <= asOf) return 'EXPIRED' as const
  return grant.remainingAmount > 0n ? 'AVAILABLE' as const : 'EMPTY' as const
}

export function rewardCouponState(coupon: {
  issuedAt: Date; expiresAt: Date
  redemptions: { status: 'RESERVED' | 'CONSUMED' | 'RESTORED' }[]
}, asOf: Date) {
  if (coupon.redemptions.some(item => item.status === 'CONSUMED')) return 'USED' as const
  if (coupon.redemptions.some(item => item.status === 'RESERVED')) return 'RESERVED' as const
  if (coupon.issuedAt > asOf) return 'PENDING' as const
  return coupon.expiresAt <= asOf ? 'EXPIRED' as const : 'AVAILABLE' as const
}
