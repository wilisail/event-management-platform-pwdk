import assert from 'node:assert/strict'
import { test } from 'node:test'
import { allocatePoints, calculateRewardQuote, RewardOperationError } from '../server/rewards/redemption-rules'
import { customerRewards } from '../server/rewards/operations'
import type { Prisma } from '../generated/prisma/client'

test('reward order is event voucher, recorded platform coupon, then only the needed points', () => {
  const quote = calculateRewardQuote({ subtotal: 100000, voucherDiscount: 10000 }, { couponId: 'coupon', pointsRequested: 80000 }, 25000)
  assert.deepEqual(quote, { subtotal: 100000, voucherDiscount: 10000, couponId: 'coupon', couponDiscount: 25000, pointsUsed: 65000, totalPrice: 0 })
  assert.equal(calculateRewardQuote({ subtotal: 100000, voucherDiscount: 10000 }, { pointsRequested: 20000 }, 0).totalPrice, 70000)
})

test('full coupon/voucher discounts do not consume unnecessary points or a zero-value coupon claim', () => {
  assert.deepEqual(calculateRewardQuote({ subtotal: 5000, voucherDiscount: 0 }, { couponId: 'coupon', pointsRequested: 10000 }, 25000),
    { subtotal: 5000, voucherDiscount: 0, couponId: 'coupon', couponDiscount: 5000, pointsUsed: 0, totalPrice: 0 })
  assert.deepEqual(calculateRewardQuote({ subtotal: 5000, voucherDiscount: 5000 }, { couponId: 'coupon', pointsRequested: 10000 }, 25000),
    { subtotal: 5000, voucherDiscount: 5000, couponId: null, couponDiscount: 0, pointsUsed: 0, totalPrice: 0 })
})

test('financial inputs reject fractions, negative/unsafe numbers and an impossible voucher', () => {
  for (const amount of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => calculateRewardQuote({ subtotal: 10000, voucherDiscount: 0 }, { pointsRequested: amount }, 0), RewardOperationError)
  }
  assert.throws(() => calculateRewardQuote({ subtotal: 5000, voucherDiscount: 5001 }, { pointsRequested: 0 }, 0))
  assert.throws(() => calculateRewardQuote({ subtotal: 5000, voucherDiscount: 0 }, { pointsRequested: 0 }, 2500))
})

test('point selection preserves earning batches and never mutates input or silently overspends', () => {
  const rows = [{ id: 'earliest', remainingAmount: 4000n }, { id: 'later', remainingAmount: 10000n }]
  assert.deepEqual(allocatePoints(rows, 7000), [{ pointGrantId: 'earliest', amount: 4000n }, { pointGrantId: 'later', amount: 3000n }])
  assert.deepEqual(allocatePoints(rows, 0), [])
  assert.equal(rows[0].remainingAmount, 4000n)
  assert.throws(() => allocatePoints(rows, 14001), (error: unknown) => error instanceof RewardOperationError && error.code === 'INSUFFICIENT_POINTS')
})

test('an ordinary Prisma root client is refused before any reward write', async () => {
  let calls = 0
  const root = { $queryRaw: async () => ++calls === 1 ? [{ transactionId: '1' }] :
    [{ id: '11111111-1111-4111-8111-111111111111', role: 'CUSTOMER', transactionId: '2' }] }
  await assert.rejects(customerRewards(root as unknown as Prisma.TransactionClient, '11111111-1111-4111-8111-111111111111'),
    (error: unknown) => error instanceof RewardOperationError && error.code === 'TRANSACTION_REQUIRED')
  assert.equal(calls, 2)
})
