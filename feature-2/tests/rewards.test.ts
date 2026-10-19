import assert from 'node:assert/strict'
import test from 'node:test'
import { addCalendarMonths, couponStatus, makeReferralGrant, walletFor } from '../domain/rewards'
import { createDemoData } from '../server/fixtures'

const now = new Date('2026-10-18T00:00:00.000Z')

test('referral awards are 10,000 points with a separate three-calendar-month expiry', () => {
  const grant = makeReferralGrant('grant', 'user', now)
  assert.equal(grant.amount, 10000)
  assert.equal(grant.remainingAmount, 10000)
  assert.equal(grant.expiresAt, '2027-01-18T00:00:00.000Z')
})
test('January 31 clamps to April 30 instead of overflowing into May', () => {
  assert.equal(
    addCalendarMonths(new Date('2026-01-31T12:34:56Z'), 3).toISOString(),
    '2026-04-30T12:34:56.000Z',
  )
})
test('expiry handles leap-year February and preserves the time', () => {
  assert.equal(
    addCalendarMonths(new Date('2023-11-30T08:00:00Z'), 3).toISOString(),
    '2024-02-29T08:00:00.000Z',
  )
})
test('invalid dates are rejected instead of producing corrupt expiry values', () => {
  assert.throws(() => addCalendarMonths(new Date('invalid'), 3), TypeError)
})
test('demo wallet has 20,000 usable points and retains expired grants in history', () => {
  const data = createDemoData(now)
  const wallet = walletFor(data.customer.id, data.pointGrants, data.coupons, now)
  assert.equal(wallet.availablePoints, 20000)
  assert.equal(wallet.pointGrants.length, 3)
  assert.equal(wallet.coupons.filter((coupon) => coupon.status === 'AVAILABLE').length, 1)
  assert.equal(wallet.coupons.find((coupon) => coupon.code === 'EXPIRED10')?.status, 'EXPIRED')
})
test('points are unavailable at the exact expiry instant', () => {
  const grant = makeReferralGrant('g', 'user', new Date('2026-07-18T00:00:00Z'))
  assert.equal(walletFor('user', [grant], [], now).availablePoints, 0)
})
test('partially spent points use the remaining amount', () => {
  const grant = { ...makeReferralGrant('g', 'user', now), remainingAmount: 4000 }
  assert.equal(walletFor('user', [grant], [], now).availablePoints, 4000)
})
test('one account never receives another account’s reward records', () => {
  const data = createDemoData(now)
  const wallet = walletFor('another-user', data.pointGrants, data.coupons, now)
  assert.equal(wallet.availablePoints, 0)
  assert.deepEqual(wallet.pointGrants, [])
  assert.deepEqual(wallet.coupons, [])
})
test('used coupons remain unavailable even before their expiry', () => {
  const coupon = { ...createDemoData(now).coupons[0], usedAt: now.toISOString() }
  assert.equal(couponStatus(coupon, now), 'USED')
})
test('wallet serialization does not mutate stored source records', () => {
  const data = createDemoData(now)
  const before = JSON.stringify(data)
  const wallet = walletFor(data.customer.id, data.pointGrants, data.coupons, now)
  wallet.pointGrants[0].remainingAmount = 1
  wallet.coupons[0].code = 'changed'
  assert.equal(JSON.stringify(data), before)
})
