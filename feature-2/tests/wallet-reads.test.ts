import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pointState, rewardCouponState, rewardInteger } from '../server/rewards/reads'

const now = new Date('2026-11-01T00:00:00.000Z')
const before = new Date('2026-10-31T23:59:59.999Z'), after = new Date('2026-11-01T00:00:00.001Z')

test('point availability includes the credit instant and excludes the exact expiry instant', () => {
  assert.equal(pointState({ creditedAt: now, expiresAt: after, remainingAmount: 10000n }, now), 'AVAILABLE')
  assert.equal(pointState({ creditedAt: before, expiresAt: now, remainingAmount: 10000n }, now), 'EXPIRED')
  assert.equal(pointState({ creditedAt: after, expiresAt: new Date('2027-02-01'), remainingAmount: 10000n }, now), 'PENDING')
  assert.equal(pointState({ creditedAt: before, expiresAt: after, remainingAmount: 0n }, now), 'EMPTY')
})

test('coupon state respects active claims and does not revive a restored but expired coupon', () => {
  const coupon = { issuedAt: before, expiresAt: after, redemptions: [] }
  assert.equal(rewardCouponState(coupon, now), 'AVAILABLE')
  assert.equal(rewardCouponState({ ...coupon, issuedAt: after }, now), 'PENDING')
  assert.equal(rewardCouponState({ ...coupon, expiresAt: now }, now), 'EXPIRED')
  assert.equal(rewardCouponState({ ...coupon, redemptions: [{ status: 'RESERVED' }] }, now), 'RESERVED')
  assert.equal(rewardCouponState({ ...coupon, expiresAt: before, redemptions: [{ status: 'CONSUMED' }] }, now), 'USED')
  assert.equal(rewardCouponState({ ...coupon, redemptions: [{ status: 'RESTORED' }] }, now), 'AVAILABLE')
  assert.equal(rewardCouponState({ ...coupon, expiresAt: now, redemptions: [{ status: 'RESTORED' }] }, now), 'EXPIRED')
})

test('reward JSON amounts refuse negative values and precision loss instead of rounding', () => {
  assert.equal(rewardInteger(0n), 0)
  assert.equal(rewardInteger(25000n), 25000)
  assert.equal(rewardInteger(BigInt(Number.MAX_SAFE_INTEGER)), Number.MAX_SAFE_INTEGER)
  assert.throws(() => rewardInteger(-1n))
  assert.throws(() => rewardInteger(BigInt(Number.MAX_SAFE_INTEGER) + 1n))
})
