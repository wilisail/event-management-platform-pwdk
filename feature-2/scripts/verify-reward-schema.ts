import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { databaseClient, disconnectDatabase } from '../server/database'
import { addCalendarMonths } from '../domain/rewards'

// Real PostgreSQL constraint/permission checks, not a reward issuance or checkout service.
// All fixtures are held in one outer transaction and rolled back at the end.
const db = databaseClient(), rollback = new Error('ROLLBACK_REWARD_SCHEMA_CHECK')
const tag = randomUUID(), emails: string[] = []
let currentCheck = 'backend role and baseline'

async function main() {
  const before = await Promise.all([db.user.count(), db.event.count(), db.ticketType.count(), db.purchase.count(),
    db.referral.count(), db.pointGrant.count(), db.rewardCoupon.count(), db.rewardRedemption.count(), db.pointAllocation.count()])
  await assert.rejects(db.$transaction(async tx => {
    assert.equal((await tx.$queryRaw<Array<{ role: string }>>`SELECT current_user AS role`)[0].role, 'temuevent_app')
    let number = 0
    async function rejectsConstraint(work: () => Promise<unknown>, expected: string) {
      const name = 'reward_schema_' + ++number
      await tx.$executeRawUnsafe('SAVEPOINT ' + name)
      try {
        await assert.rejects(work(), error => {
          const value = error as { message?: string; meta?: unknown }
          const detail = String(value.message) + ' ' + JSON.stringify(value.meta)
          assert.ok(detail.includes(expected), 'Expected database constraint/permission failure: ' + expected)
          return true
        })
      } finally {
        await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ' + name)
        await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + name)
      }
    }
    currentCheck = 'isolated users, referrals, point batches and coupons'
    const users = []
    for (let index = 0; index < 4; index++) {
      const email = 'reward-schema-' + index + '-' + tag + '@example.test'
      emails.push(email)
      users.push(await tx.user.create({ data: { email, name: 'Reward schema ' + index,
        referralCode: randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase() } }))
    }
    const [referrer, newcomer, other, otherNewcomer] = users
    const at = new Date(), expiry = addCalendarMonths(at, 3)
    const referral = await tx.referral.create({ data: { referrerId: referrer.id, referredUserId: newcomer.id } })
    const secondReferral = await tx.referral.create({ data: { referrerId: other.id, referredUserId: otherNewcomer.id } })
    const grant = await tx.pointGrant.create({ data: { referralId: referral.id, userId: referrer.id,
      amount: 10000n, remainingAmount: 10000n, creditedAt: at, expiresAt: expiry } })
    const coupon = await tx.rewardCoupon.create({ data: { referralId: referral.id, userId: newcomer.id,
      code: 'QA' + tag.replaceAll('-', '').slice(0, 20).toUpperCase(), discountValue: 25000n, issuedAt: at, expiresAt: expiry } })
    assert.equal((await tx.referral.findUniqueOrThrow({ where: { id: referral.id }, include: { pointGrant: true, rewardCoupon: true } })).pointGrant?.userId, referrer.id)

    currentCheck = 'self referral, duplicate incoming referral and wrong reward recipient'
    await rejectsConstraint(() => tx.$executeRaw`INSERT INTO temuevent.referrals(referrer_id,referred_user_id) VALUES (${referrer.id}::uuid,${referrer.id}::uuid)`, 'referrals_not_self')
    await rejectsConstraint(() => tx.$executeRaw`INSERT INTO temuevent.referrals(referrer_id,referred_user_id) VALUES (${other.id}::uuid,${newcomer.id}::uuid)`, 'referrals_referred_user_id_key')
    await rejectsConstraint(() => tx.$executeRaw`INSERT INTO temuevent.point_grants(user_id,referral_id,amount,remaining_amount,credited_at,expires_at) VALUES (${newcomer.id}::uuid,${secondReferral.id}::uuid,10000,10000,${at},${expiry})`, 'point_grants_referral_id_user_id_fkey')
    await rejectsConstraint(() => tx.$executeRaw`INSERT INTO temuevent.reward_coupons(user_id,referral_id,code,discount_value,issued_at,expires_at) VALUES (${other.id}::uuid,${secondReferral.id}::uuid,'WRONGOWNER',25000,${at},${expiry})`, 'reward_coupons_referral_id_user_id_fkey')
    await rejectsConstraint(() => tx.$executeRaw`INSERT INTO temuevent.point_grants(user_id,referral_id,amount,remaining_amount,credited_at,expires_at) VALUES (${referrer.id}::uuid,${referral.id}::uuid,10000,10000,${at},${expiry})`, 'point_grants_referral_id_key')

    currentCheck = 'point bounds and expiry constraints'
    await rejectsConstraint(() => tx.pointGrant.update({ where: { id: grant.id }, data: { remainingAmount: -1n } }), 'point_grants_remaining_bounds')
    await rejectsConstraint(() => tx.pointGrant.update({ where: { id: grant.id }, data: { remainingAmount: 10001n } }), 'point_grants_remaining_bounds')
    await rejectsConstraint(() => tx.pointGrant.update({ where: { id: grant.id }, data: { expiresAt: at } }), 'point_grants_expiry_order')

    currentCheck = 'purchase ownership, active coupon uniqueness and release'
    const event = await tx.event.findFirstOrThrow()
    async function purchase(userId: string, label: string) {
      return tx.purchase.create({ data: { customerId: userId, eventId: event.id,
        reference: 'REWARD-SCHEMA-' + tag + '-' + label, subtotal: 50000n, totalPrice: 50000n,
        paymentDueAt: new Date(Date.now() + 2 * 60 * 60 * 1000) } })
    }
    const p1 = await purchase(newcomer.id, 'coupon-1'), p2 = await purchase(newcomer.id, 'coupon-2'), p3 = await purchase(newcomer.id, 'coupon-3')
    const ownPurchase = await purchase(referrer.id, 'points')
    await rejectsConstraint(() => tx.$executeRaw`INSERT INTO temuevent.reward_redemptions(user_id,purchase_id,points_used) VALUES (${referrer.id}::uuid,${p2.id}::uuid,1000)`, 'reward_redemptions_user_id_purchase_id_fkey')
    await rejectsConstraint(() => tx.$executeRaw`INSERT INTO temuevent.reward_redemptions(user_id,purchase_id,coupon_id,coupon_discount) VALUES (${referrer.id}::uuid,${ownPurchase.id}::uuid,${coupon.id}::uuid,25000)`, 'reward_redemptions_user_id_coupon_id_fkey')
    const claim = await tx.rewardRedemption.create({ data: { userId: newcomer.id, purchaseId: p1.id,
      couponId: coupon.id, couponDiscount: 25000n } })
    await rejectsConstraint(() => tx.$executeRaw`INSERT INTO temuevent.reward_redemptions(user_id,purchase_id,points_used) VALUES (${newcomer.id}::uuid,${p1.id}::uuid,1000)`, 'reward_redemptions_purchase_id_key')
    await rejectsConstraint(() => tx.$executeRaw`INSERT INTO temuevent.reward_redemptions(user_id,purchase_id,coupon_id,coupon_discount) VALUES (${newcomer.id}::uuid,${p2.id}::uuid,${coupon.id}::uuid,25000)`, 'reward_redemptions_active_coupon_key')
    await tx.rewardRedemption.update({ where: { id: claim.id }, data: { status: 'RESTORED', restoredAt: new Date() } })
    const next = await tx.rewardRedemption.create({ data: { userId: newcomer.id, purchaseId: p2.id, couponId: coupon.id, couponDiscount: 25000n } })
    await tx.rewardRedemption.update({ where: { id: next.id }, data: { status: 'CONSUMED', consumedAt: new Date() } })
    await rejectsConstraint(() => tx.$executeRaw`INSERT INTO temuevent.reward_redemptions(user_id,purchase_id,coupon_id,coupon_discount) VALUES (${newcomer.id}::uuid,${p3.id}::uuid,${coupon.id}::uuid,25000)`, 'reward_redemptions_active_coupon_key')

    currentCheck = 'exact point batch ownership and allocation constraints'
    const otherGrant = await tx.pointGrant.create({ data: { referralId: secondReferral.id, userId: other.id,
      amount: 10000n, remainingAmount: 10000n, creditedAt: at, expiresAt: expiry } })
    const pointClaim = await tx.rewardRedemption.create({ data: { userId: referrer.id, purchaseId: ownPurchase.id, pointsUsed: 2000n } })
    await tx.pointAllocation.create({ data: { userId: referrer.id, redemptionId: pointClaim.id, pointGrantId: grant.id, amount: 2000n } })
    await rejectsConstraint(() => tx.$executeRaw`INSERT INTO temuevent.point_allocations(user_id,redemption_id,point_grant_id,amount) VALUES (${referrer.id}::uuid,${pointClaim.id}::uuid,${otherGrant.id}::uuid,1)`, 'point_allocations_user_id_point_grant_id_fkey')
    await rejectsConstraint(() => tx.$executeRaw`INSERT INTO temuevent.point_allocations(user_id,redemption_id,point_grant_id,amount) VALUES (${referrer.id}::uuid,${claim.id}::uuid,${grant.id}::uuid,1)`, 'point_allocations_user_id_redemption_id_fkey')
    await rejectsConstraint(() => tx.$executeRaw`INSERT INTO temuevent.point_allocations(user_id,redemption_id,point_grant_id,amount) VALUES (${referrer.id}::uuid,${pointClaim.id}::uuid,${grant.id}::uuid,0)`, 'point_allocations_positive_amount')
    assert.equal((await tx.pointAllocation.findMany({ where: { redemptionId: pointClaim.id } }))[0].amount, 2000n)
    await rejectsConstraint(() => tx.rewardRedemption.update({ where: { id: pointClaim.id }, data: { status: 'CONSUMED' } }), 'reward_redemptions_timestamp_state')

    currentCheck = 'immutable issuance/allocation records and no destructive backend privilege'
    await rejectsConstraint(() => tx.$executeRaw`UPDATE temuevent.reward_coupons SET code='CHANGED' WHERE id=${coupon.id}::uuid`, 'permission denied')
    await rejectsConstraint(() => tx.$executeRaw`DELETE FROM temuevent.point_grants WHERE id=${grant.id}::uuid`, 'permission denied')
    throw rollback
  }, { timeout: 60000 }), error => error === rollback)
  currentCheck = 'rollback preserves the shared baseline'
  assert.equal(await db.user.count({ where: { email: { in: emails } } }), 0)
  const after = await Promise.all([db.user.count(), db.event.count(), db.ticketType.count(), db.purchase.count(),
    db.referral.count(), db.pointGrant.count(), db.rewardCoupon.count(), db.rewardRedemption.count(), db.pointAllocation.count()])
  assert.deepEqual(after, before)
  console.log('REWARD_SCHEMA_OK: relations, ownership, duplicates, bounds, expiry, coupon exclusivity/reuse, allocations, permissions; all QA writes rolled back')
}
main().catch(error => {
  console.error('Reward schema verification failed at: ' + currentCheck)
  const detail = String((error as Error)?.message).match(/Expected database constraint\/permission failure: [\w ]+/)?.[0]
  if (detail) console.error(detail)
  process.exitCode = 1
}).finally(disconnectDatabase)
