export class RewardOperationError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 409) {
    super(message)
    this.name = 'RewardOperationError'
  }
}

export interface RewardSelection { pointsRequested: number; couponId?: string | null }
export interface RewardPricing { subtotal: number; voucherDiscount: number }
export interface RewardQuote extends RewardPricing {
  couponId: string | null
  couponDiscount: number
  pointsUsed: number
  totalPrice: number
}

export function wholeAmount(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new RewardOperationError('INVALID_REWARD_AMOUNT', 'Use nonnegative whole IDR/point amounts', 400)
  return value
}

export function calculateRewardQuote(pricing: RewardPricing, selection: RewardSelection, couponValue: number): RewardQuote {
  const subtotal = wholeAmount(pricing.subtotal), voucherDiscount = wholeAmount(pricing.voucherDiscount)
  const requested = wholeAmount(selection.pointsRequested), value = wholeAmount(couponValue)
  if (value && !selection.couponId) throw new RewardOperationError('INVALID_REWARD_SELECTION', 'A coupon value requires a coupon identity', 400)
  if (voucherDiscount > subtotal) throw new RewardOperationError('INVALID_REWARD_AMOUNT', 'Voucher discount exceeds subtotal', 400)
  const afterVoucher = subtotal - voucherDiscount
  const couponDiscount = Math.min(value, afterVoucher)
  const pointsUsed = Math.min(requested, afterVoucher - couponDiscount)
  return { subtotal, voucherDiscount, couponId: couponDiscount ? selection.couponId ?? null : null,
    couponDiscount, pointsUsed, totalPrice: afterVoucher - couponDiscount - pointsUsed }
}

/** Rows are locked/ordered by expiresAt then id by the repository. */
export function allocatePoints(grants: readonly { id: string; remainingAmount: bigint }[], amount: number) {
  let needed = BigInt(wholeAmount(amount))
  const allocations: { pointGrantId: string; amount: bigint }[] = []
  for (const grant of grants) {
    if (!needed) break
    const used = grant.remainingAmount < needed ? grant.remainingAmount : needed
    if (used > 0n) { allocations.push({ pointGrantId: grant.id, amount: used }); needed -= used }
  }
  if (needed) throw new RewardOperationError('INSUFFICIENT_POINTS', 'The available points have changed')
  return allocations
}
