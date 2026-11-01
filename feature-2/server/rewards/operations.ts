import { z } from 'zod'
import type { Prisma } from '../../generated/prisma/client'
import { rewardInteger } from './reads'
import { allocatePoints, calculateRewardQuote, RewardOperationError, wholeAmount,
  type RewardPricing, type RewardQuote, type RewardSelection } from './redemption-rules'

export { RewardOperationError } from './redemption-rules'
export type { RewardPricing, RewardQuote, RewardSelection } from './redemption-rules'

export interface RewardClaimView {
  purchaseId: string
  redemptionId: string | null
  status: 'NONE' | 'RESERVED' | 'CONSUMED' | 'RESTORED'
  pointsUsed: number
  couponId: string | null
  couponDiscount: number
  allocations: { pointGrantId: string; amount: number }[]
}
type PurchaseRow = { id: string; customerId: string; status: string; subtotal: bigint; voucherDiscount: bigint;
  pointsUsed: bigint; couponDiscount: bigint; totalPrice: bigint; paymentDueAt: Date | null }
const uuid = (value: string) => {
  if (!z.uuid().safeParse(value).success) throw new RewardOperationError('INVALID_REWARD_ID', 'Use a valid account, purchase or coupon UUID', 400)
  return value
}

/** Join the caller's transaction; call this before acquiring purchase/inventory locks. */
export async function customerRewards(tx: Prisma.TransactionClient, customerId: string, options: { now?: () => Date } = {}) {
  if (!tx || typeof tx.$queryRaw !== 'function') {
    throw new RewardOperationError('TRANSACTION_REQUIRED', 'Supply the caller\'s Prisma transaction client', 500)
  }
  uuid(customerId)
  // Verify the real SQL boundary, rather than relying on Prisma's private proxy properties.
  const first = await tx.$queryRaw<{ transactionId: string }[]>`SELECT pg_current_xact_id()::text AS "transactionId"`
  const users = await tx.$queryRaw<{ id: string; role: string; transactionId: string }[]>`
    SELECT id, role::text AS role, pg_current_xact_id()::text AS "transactionId"
    FROM temuevent.users WHERE id = ${customerId}::uuid FOR UPDATE`
  if (users.length && users[0].transactionId !== first[0]?.transactionId) {
    throw new RewardOperationError('TRANSACTION_REQUIRED', 'Reward calls must share one SQL transaction', 500)
  }
  if (!users.length || users[0].role !== 'CUSTOMER') throw new RewardOperationError('CUSTOMER_REQUIRED', 'Rewards require a customer account', 403)
  const now = () => {
    const value = new Date((options.now ?? (() => new Date()))().getTime())
    if (!Number.isFinite(value.getTime())) throw new RewardOperationError('INVALID_REWARD_CLOCK', 'Invalid backend clock', 500)
    return value
  }
  const purchase = async (id: string): Promise<PurchaseRow | null> => {
    const rows = await tx.$queryRaw<PurchaseRow[]>`
      SELECT id, customer_id AS "customerId", status::text AS status, subtotal,
        voucher_discount AS "voucherDiscount", points_used AS "pointsUsed",
        coupon_discount AS "couponDiscount", total_price AS "totalPrice", payment_due_at AS "paymentDueAt"
      FROM temuevent.purchases WHERE id = ${uuid(id)}::uuid AND customer_id = ${customerId}::uuid FOR UPDATE`
    return rows[0] ?? null
  }
  const claim = (id: string) => tx.rewardRedemption.findUnique({ where: { purchaseId: id }, include: { allocations: { orderBy: { pointGrantId: 'asc' } } } })
  type Claim = NonNullable<Awaited<ReturnType<typeof claim>>>
  const view = (row: Claim): RewardClaimView => ({
    purchaseId: row.purchaseId, redemptionId: row.id, status: row.status,
    pointsUsed: rewardInteger(row.pointsUsed), couponId: row.couponId, couponDiscount: rewardInteger(row.couponDiscount),
    allocations: row.allocations.map(item => ({ pointGrantId: item.pointGrantId, amount: rewardInteger(item.amount) })),
  })
  const none = (id: string): RewardClaimView => ({ purchaseId: id, redemptionId: null, status: 'NONE',
    pointsUsed: 0, couponId: null, couponDiscount: 0, allocations: [] })
  const assertSnapshot = (p: PurchaseRow, q: RewardQuote) => {
    if (p.subtotal !== BigInt(q.subtotal) || p.voucherDiscount !== BigInt(q.voucherDiscount) ||
      p.pointsUsed !== BigInt(q.pointsUsed) || p.couponDiscount !== BigInt(q.couponDiscount) || p.totalPrice !== BigInt(q.totalPrice)) {
      throw new RewardOperationError('REWARD_SNAPSHOT_MISMATCH', 'Purchase amounts do not match the calculated rewards')
    }
  }
  const assertClaim = (p: PurchaseRow, row: Claim) => {
    if (row.userId !== customerId || row.pointsUsed !== p.pointsUsed || row.couponDiscount !== p.couponDiscount ||
      row.allocations.reduce((sum, item) => sum + item.amount, 0n) !== row.pointsUsed) {
      throw new RewardOperationError('REWARD_INTEGRITY_ERROR', 'Purchase reward records are inconsistent')
    }
  }
  const replay = (p: PurchaseRow, row: Claim, selection: RewardSelection) => {
    assertClaim(p, row)
    const expected = Math.min(wholeAmount(selection.pointsRequested), rewardInteger(p.subtotal - p.voucherDiscount - p.couponDiscount))
    if (row.pointsUsed !== BigInt(expected) || row.couponId !== (selection.couponId ?? null)) {
      throw new RewardOperationError('REWARD_REPLAY_CONFLICT', 'This purchase already has a different reward selection')
    }
    return view(row)
  }
  const price = async (pricing: RewardPricing, selection: RewardSelection, at: Date) => {
    wholeAmount(selection.pointsRequested)
    if (selection.couponId != null) uuid(selection.couponId)
    let couponValue = 0
    if (selection.couponId) {
      const coupon = await tx.rewardCoupon.findFirst({ where: { id: uuid(selection.couponId), userId: customerId,
        issuedAt: { lte: at }, expiresAt: { gt: at },
        redemptions: { none: { status: { in: ['RESERVED', 'CONSUMED'] } } } }, select: { discountValue: true } })
      if (!coupon) throw new RewardOperationError('COUPON_UNAVAILABLE', 'The selected coupon is unavailable')
      couponValue = rewardInteger(coupon.discountValue)
    }
    return calculateRewardQuote(pricing, selection, couponValue)
  }
  const grantPlan = async (pointsUsed: number, at: Date) => {
    if (!pointsUsed) return []
    const rows = await tx.$queryRaw<{ id: string; remainingAmount: bigint }[]>`
      SELECT id, remaining_amount AS "remainingAmount" FROM temuevent.point_grants
      WHERE user_id = ${customerId}::uuid AND credited_at <= ${at} AND expires_at > ${at} AND remaining_amount > 0
      ORDER BY expires_at, id FOR UPDATE`
    return allocatePoints(rows, pointsUsed)
  }
  const reserve = async (id: string, selection: RewardSelection, immediate = false): Promise<RewardClaimView> => {
    wholeAmount(selection.pointsRequested)
    const p = await purchase(id)
    if (!p) throw new RewardOperationError('PURCHASE_NOT_FOUND', 'Purchase not found', 404)
    const existing = await claim(id)
    if (existing) return replay(p, existing, selection)
    const at = now()
    const zeroConfirmation = immediate && p.status === 'DONE' && p.totalPrice === 0n
    if (!zeroConfirmation && (p.status !== 'WAITING_FOR_PAYMENT' || !p.paymentDueAt || p.paymentDueAt <= at)) {
      throw new RewardOperationError('PURCHASE_NOT_RESERVABLE', 'This purchase cannot reserve rewards')
    }
    const quote = await price({ subtotal: rewardInteger(p.subtotal), voucherDiscount: rewardInteger(p.voucherDiscount) }, selection, at)
    assertSnapshot(p, quote)
    if (!quote.pointsUsed && !quote.couponDiscount) return none(id)
    const allocations = await grantPlan(quote.pointsUsed, at)
    const row = await tx.rewardRedemption.create({ data: { purchaseId: id, userId: customerId,
      couponId: quote.couponId, couponDiscount: BigInt(quote.couponDiscount), pointsUsed: BigInt(quote.pointsUsed),
      status: zeroConfirmation ? 'CONSUMED' : 'RESERVED', reservedAt: at, consumedAt: zeroConfirmation ? at : null } })
    for (const item of allocations) {
      const updated = await tx.pointGrant.updateMany({ where: { id: item.pointGrantId, userId: customerId,
        remainingAmount: { gte: item.amount }, creditedAt: { lte: at }, expiresAt: { gt: at } },
      data: { remainingAmount: { decrement: item.amount } } })
      if (updated.count !== 1) throw new RewardOperationError('POINTS_CHANGED', 'The available points have changed')
      await tx.pointAllocation.create({ data: { redemptionId: row.id, pointGrantId: item.pointGrantId, userId: customerId, amount: item.amount } })
    }
    return view((await claim(id))!)
  }
  const terminal = async (id: string, action: 'consume' | 'restore'): Promise<RewardClaimView> => {
    const p = await purchase(id)
    if (!p) throw new RewardOperationError('PURCHASE_NOT_FOUND', 'Purchase not found', 404)
    if (action === 'consume' ? p.status !== 'DONE' : !['REJECTED', 'EXPIRED', 'CANCELED'].includes(p.status)) {
      throw new RewardOperationError('PURCHASE_STATE_CONFLICT', 'Purchase status does not permit this reward action')
    }
    const row = await claim(id)
    if (!row) {
      if (!p.pointsUsed && !p.couponDiscount) return none(id)
      throw new RewardOperationError('REWARD_CLAIM_MISSING', 'The purchase has no matching reward reservation')
    }
    assertClaim(p, row)
    if (action === 'consume' && row.status === 'RESTORED') throw new RewardOperationError('REWARD_STATE_CONFLICT', 'Restored rewards cannot be consumed')
    if (action === 'consume' && row.status === 'CONSUMED' || action === 'restore' && row.status === 'RESTORED') return view(row)
    const at = now()
    if (at < row.reservedAt || row.consumedAt && at < row.consumedAt) throw new RewardOperationError('REWARD_CLOCK_CONFLICT', 'Backend clock precedes reward history')
    if (action === 'restore') {
      for (const item of [...row.allocations].sort((a, b) => a.pointGrantId.localeCompare(b.pointGrantId))) {
        const original = await tx.pointGrant.findUniqueOrThrow({ where: { id: item.pointGrantId } })
        const restored = await tx.pointGrant.updateMany({ where: { id: item.pointGrantId, userId: customerId,
          remainingAmount: { lte: original.amount - item.amount } }, data: { remainingAmount: { increment: item.amount } } })
        if (restored.count !== 1) throw new RewardOperationError('REWARD_INTEGRITY_ERROR', 'Cannot restore the original point allocation')
      }
    }
    const changed = await tx.rewardRedemption.updateMany({ where: { id: row.id, userId: customerId, status: row.status },
      data: action === 'consume' ? { status: 'CONSUMED', consumedAt: at } : { status: 'RESTORED', restoredAt: at } })
    if (changed.count !== 1) throw new RewardOperationError('REWARD_STATE_CONFLICT', 'Reward state changed')
    return view((await claim(id))!)
  }
  return {
    /** A quote holds no independent reservation; keep all calls inside this transaction. */
    quote: async (pricing: RewardPricing, selection: RewardSelection) => {
      const at = now(), quote = await price(pricing, selection, at)
      await grantPlan(quote.pointsUsed, at)
      return quote
    },
    reserve: (id: string, selection: RewardSelection) => reserve(id, selection),
    consume: (id: string) => terminal(id, 'consume'),
    restore: (id: string) => terminal(id, 'restore'),
    /** Callback creates feature 1's purchase/items/seats; this service owns only rewards. */
    async reserveNewPurchase(input: RewardPricing & RewardSelection & { purchaseId: string }, createPurchase: (quote: RewardQuote) => Promise<void>) {
      if (input.couponId != null) uuid(input.couponId)
      const existing = await purchase(input.purchaseId)
      if (existing) {
        const row = await claim(input.purchaseId)
        if (!row && !existing.pointsUsed && !existing.couponDiscount &&
          existing.subtotal === BigInt(wholeAmount(input.subtotal)) && existing.voucherDiscount === BigInt(wholeAmount(input.voucherDiscount)) &&
          !Math.min(wholeAmount(input.pointsRequested), rewardInteger(existing.totalPrice)) && (!input.couponId || existing.totalPrice === 0n)) return none(input.purchaseId)
        if (row) {
          if (existing.subtotal !== BigInt(wholeAmount(input.subtotal)) || existing.voucherDiscount !== BigInt(wholeAmount(input.voucherDiscount))) {
            throw new RewardOperationError('REWARD_REPLAY_CONFLICT', 'Purchase pricing differs from the recorded checkout')
          }
          return replay(existing, row, input)
        }
        throw new RewardOperationError('PURCHASE_ALREADY_EXISTS', 'Do not backfill rewards onto an existing purchase')
      }
      const at = now(), quote = await price(input, input, at)
      await grantPlan(quote.pointsUsed, at)
      await createPurchase(quote)
      const created = await purchase(input.purchaseId)
      if (!created) throw new RewardOperationError('PURCHASE_NOT_CREATED', 'Checkout callback did not create the owned purchase')
      assertSnapshot(created, quote)
      return reserve(input.purchaseId, input, true)
    },
  }
}

export type CustomerRewards = Awaited<ReturnType<typeof customerRewards>>
