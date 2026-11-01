import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { Prisma } from '../generated/prisma/client'
import { databaseClient, disconnectDatabase } from '../server/database'
import { customerRewards, RewardOperationError } from '../server/rewards/operations'
import { prismaRewardReadRepository } from '../server/rewards/read-repository'
import { rewardFixture, testCheckout } from './helpers/reward-fixtures'

const db = databaseClient(), rollback = new Error('ROLLBACK_REWARD_OPERATIONS_CHECK')
let stage = 'baseline', sequence = 0
async function main() {
  const counts = () => Promise.all([db.user.count(), db.event.count(), db.ticketType.count(), db.purchase.count(),
    db.referral.count(), db.pointGrant.count(), db.rewardCoupon.count(), db.rewardRedemption.count(), db.pointAllocation.count()])
  const before = await counts()
  await assert.rejects(db.$transaction(async tx => {
    const at = new Date(), f = await rewardFixture(tx, at)
    let clock = at
    const ops = () => customerRewards(tx, f.owner.id, { now: () => clock })
    const snapshot = async () => ({ purchases: await tx.purchase.count(), claims: await tx.rewardRedemption.count(),
      allocations: await tx.pointAllocation.count(), seats: (await tx.ticketType.findUniqueOrThrow({ where: { id: f.ticket.id } })).availableSeats,
      remaining: (await tx.pointGrant.findMany({ where: { userId: f.owner.id }, orderBy: { id: 'asc' } })).map(row => row.remainingAmount) })
    const scenario = async (name: string, work: () => Promise<void>) => {
      stage = name; clock = at
      const savepoint = 'reward_case_' + ++sequence
      await tx.$executeRawUnsafe('SAVEPOINT ' + savepoint)
      try { await work() } finally {
        await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ' + savepoint)
        await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + savepoint)
      }
    }
    const code = (expected: string) => (error: unknown) => error instanceof RewardOperationError && error.code === expected
    await scenario('FEFO reserve, coupon hold, allocations and retry', async () => {
      const rewards = await ops(), out = await testCheckout(tx, f, rewards, { pointsRequested: 12000, couponId: f.coupon.id })
      assert.equal(out.result.status, 'RESERVED'); assert.equal(out.result.couponDiscount, 25000)
      assert.deepEqual(out.result.allocations.map(a => [a.pointGrantId, a.amount]).sort(), [[f.grants[0].id, 10000], [f.grants[1].id, 2000]].sort())
      assert.equal((await tx.pointGrant.findUniqueOrThrow({ where: { id: f.grants[0].id } })).remainingAmount, 0n)
      assert.equal((await tx.pointGrant.findUniqueOrThrow({ where: { id: f.grants[1].id } })).remainingAmount, 8000n)
      const state = await snapshot()
      const replay = await rewards.reserveNewPurchase(out.input, async () => { throw new Error('Replay must not execute checkout twice') })
      assert.deepEqual(replay, out.result); assert.deepEqual(await snapshot(), state)
      await assert.rejects(rewards.reserve(out.purchaseId, { pointsRequested: 12001, couponId: f.coupon.id }), code('REWARD_REPLAY_CONFLICT'))
      await assert.rejects(testCheckout(tx, f, rewards, { pointsRequested: 0, couponId: f.coupon.id }), code('COUPON_UNAVAILABLE'))
      assert.deepEqual(await snapshot(), state)
    })
    await scenario('consume only after DONE, once and without second deduction', async () => {
      const rewards = await ops(), out = await testCheckout(tx, f, rewards, { pointsRequested: 12000 })
      await assert.rejects(rewards.consume(out.purchaseId), code('PURCHASE_STATE_CONFLICT'))
      await tx.purchase.update({ where: { id: out.purchaseId }, data: { status: 'DONE', completedAt: at } })
      const state = await snapshot(), first = await rewards.consume(out.purchaseId)
      assert.equal(first.status, 'CONSUMED'); assert.deepEqual(await rewards.consume(out.purchaseId), first)
      assert.deepEqual(await snapshot(), state)
    })
    await scenario('terminal restoration returns original batches and releases the coupon exactly once', async () => {
      const rewards = await ops(), out = await testCheckout(tx, f, rewards, { pointsRequested: 12000, couponId: f.coupon.id })
      await assert.rejects(rewards.restore(out.purchaseId), code('PURCHASE_STATE_CONFLICT'))
      await tx.purchase.update({ where: { id: out.purchaseId }, data: { status: 'REJECTED' } })
      const restored = await rewards.restore(out.purchaseId)
      assert.equal(restored.status, 'RESTORED'); assert.deepEqual(await rewards.restore(out.purchaseId), restored)
      for (const grant of f.grants.slice(0, 2)) {
        const row = await tx.pointGrant.findUniqueOrThrow({ where: { id: grant.id } })
        assert.equal(row.remainingAmount, 10000n); assert.equal(row.expiresAt.toISOString(), grant.expiresAt.toISOString())
      }
      const next = await testCheckout(tx, f, rewards, { pointsRequested: 0, couponId: f.coupon.id })
      assert.equal(next.result.status, 'RESERVED')
      assert.equal(await tx.rewardRedemption.count({ where: { couponId: f.coupon.id } }), 2)
    })
    await scenario('expired restored awards remain stored but unspendable', async () => {
      const rewards = await ops(), out = await testCheckout(tx, f, rewards, { pointsRequested: 12000, couponId: f.coupon.id })
      clock = new Date(f.coupon.expiresAt.getTime() + 1)
      await tx.purchase.update({ where: { id: out.purchaseId }, data: { status: 'EXPIRED' } })
      await rewards.restore(out.purchaseId); await rewards.restore(out.purchaseId)
      const wallet = await prismaRewardReadRepository(tx, work => work(tx)).wallet(f.owner.id, clock, { pointPage: 1, couponPage: 1, pageSize: 10 })
      assert.equal(wallet.availablePoints, 0); assert.equal(wallet.coupons.items[0].status, 'EXPIRED')
      assert.equal((await tx.rewardCoupon.findUniqueOrThrow({ where: { id: f.coupon.id } })).expiresAt.toISOString(), f.coupon.expiresAt.toISOString())
    })
    await scenario('ownership, balance, missing records and exact payment deadline', async () => {
      const other = await customerRewards(tx, f.other.id, { now: () => at })
      await assert.rejects(other.quote({ subtotal: 100000, voucherDiscount: 0 }, { pointsRequested: 0, couponId: f.coupon.id }), code('COUPON_UNAVAILABLE'))
      await assert.rejects(customerRewards(tx, f.organizer.id), code('CUSTOMER_REQUIRED'))
      const rewards = await ops(), state = await snapshot()
      await assert.rejects(testCheckout(tx, f, rewards, { pointsRequested: 20001 }), code('INSUFFICIENT_POINTS'))
      assert.deepEqual(await snapshot(), state)
      await assert.rejects(rewards.reserve(randomUUID(), { pointsRequested: 0 }), code('PURCHASE_NOT_FOUND'))
      const out = await testCheckout(tx, f, rewards, { pointsRequested: 0 })
      await assert.rejects(other.reserve(out.purchaseId, { pointsRequested: 0 }), code('PURCHASE_NOT_FOUND'))
      clock = new Date(at.getTime() + 7200000)
      await assert.rejects(rewards.reserve(out.purchaseId, { pointsRequested: 0 }), code('PURCHASE_NOT_RESERVABLE'))
    })
    await scenario('zero payable confirmation consumes only required rewards and free orders create no empty claim', async () => {
      const rewards = await ops(), zero = await testCheckout(tx, f, rewards, { subtotal: 30000, pointsRequested: 50000, couponId: f.coupon.id })
      assert.equal(zero.result.status, 'CONSUMED'); assert.equal(zero.result.pointsUsed, 5000)
      const p = await tx.purchase.findUniqueOrThrow({ where: { id: zero.purchaseId } })
      assert.equal(p.totalPrice, 0n); assert.equal(p.status, 'DONE'); assert.equal(p.paymentDueAt, null)
      assert.deepEqual(await rewards.consume(p.id), zero.result)
      const free = await testCheckout(tx, f, rewards, { subtotal: 0, pointsRequested: 0 })
      assert.equal(free.result.status, 'NONE')
      assert.equal(await tx.rewardRedemption.count({ where: { purchaseId: free.purchaseId } }), 0)
      assert.equal((await rewards.reserveNewPurchase(free.input, async () => { throw new Error('duplicate free callback') })).status, 'NONE')
      await assert.rejects(rewards.reserve(free.purchaseId, { pointsRequested: 0 }), code('PURCHASE_NOT_RESERVABLE'))
    })
    await scenario('late failure rolls back purchase/items, inventory, claim and allocations together', async () => {
      const beforeAttempt = await snapshot(), fault = new Error('INJECTED_CHECKOUT_FAILURE')
      const name = 'reward_failure_' + ++sequence
      await tx.$executeRawUnsafe('SAVEPOINT ' + name)
      try {
        await assert.rejects((async () => { const rewards = await ops(); await testCheckout(tx, f, rewards, { pointsRequested: 12000, couponId: f.coupon.id }); throw fault })(), error => error === fault)
      } finally { await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ' + name); await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + name) }
      assert.deepEqual(await snapshot(), beforeAttempt)
    })
    await scenario('a full event voucher does not consume an unnecessary coupon or points, including replay', async () => {
      const rewards = await ops()
      const out = await testCheckout(tx, f, rewards, { subtotal: 10000, voucherDiscount: 10000,
        pointsRequested: 10000, couponId: f.coupon.id })
      assert.equal(out.result.status, 'NONE')
      assert.equal((await rewards.reserveNewPurchase(out.input, async () => { throw new Error('Unexpected duplicate checkout') })).status, 'NONE')
      const wallet = await prismaRewardReadRepository(tx, work => work(tx)).wallet(f.owner.id, at, { pointPage: 1, couponPage: 1, pageSize: 10 })
      assert.equal(wallet.availablePoints, 20000); assert.equal(wallet.availableCouponCount, 1)
    })
    await scenario('old completed purchases cannot gain a retrospective reward claim', async () => {
      const rewards = await ops(), out = await testCheckout(tx, f, rewards, { pointsRequested: 0 })
      await tx.purchase.update({ where: { id: out.purchaseId }, data: { status: 'DONE', completedAt: at } })
      await assert.rejects(rewards.reserveNewPurchase({ ...out.input, pointsRequested: 10000 }, async () => { throw new Error('Unexpected historical checkout') }), code('PURCHASE_ALREADY_EXISTS'))
      await assert.rejects(rewards.reserve(out.purchaseId, { pointsRequested: 10000 }), code('PURCHASE_NOT_RESERVABLE'))
      assert.equal(await tx.rewardRedemption.count({ where: { purchaseId: out.purchaseId } }), 0)
    })
    await scenario('a mismatched purchase snapshot aborts checkout rather than charging different discounts', async () => {
      const beforeAttempt = await snapshot(), id = randomUUID(), name = 'reward_snapshot_failure_' + ++sequence
      await tx.$executeRawUnsafe('SAVEPOINT ' + name)
      try {
        const rewards = await ops()
        await assert.rejects(testCheckout(tx, f, rewards, { purchaseId: id, pointsRequested: 10000 }, async quote => {
          await tx.purchase.update({ where: { id }, data: { pointsUsed: 0n, totalPrice: BigInt(quote.totalPrice + quote.pointsUsed) } })
        }), code('REWARD_SNAPSHOT_MISMATCH'))
      } finally { await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ' + name); await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + name) }
      assert.deepEqual(await snapshot(), beforeAttempt)
    })
    await scenario('partial restoration failure rolls back prior returned points and the purchase status', async () => {
      const rewards = await ops(), out = await testCheckout(tx, f, rewards, { pointsRequested: 12000 })
      const beforeAttempt = await snapshot(), fault = new Error('INJECTED_RESTORE_FAILURE')
      const name = 'reward_restore_failure_' + ++sequence
      await tx.$executeRawUnsafe('SAVEPOINT ' + name)
      try {
        let updates = 0
        const broken = new Proxy(tx, { get(target, key) {
          const value = Reflect.get(target, key)
          if (key !== 'pointGrant') return value
          return new Proxy(value, { get(delegate, method) {
            if (method === 'updateMany') return (...args: unknown[]) => { if (++updates === 2) throw fault; return delegate.updateMany(...args) }
            return Reflect.get(delegate, method)
          } })
        } }) as Prisma.TransactionClient
        const fail = await customerRewards(broken, f.owner.id, { now: () => at })
        await tx.purchase.update({ where: { id: out.purchaseId }, data: { status: 'REJECTED' } })
        await assert.rejects(fail.restore(out.purchaseId), error => error === fault)
      } finally { await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ' + name); await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + name) }
      assert.deepEqual(await snapshot(), beforeAttempt)
      assert.equal((await tx.purchase.findUniqueOrThrow({ where: { id: out.purchaseId } })).status, 'WAITING_FOR_PAYMENT')
      assert.equal((await tx.rewardRedemption.findUniqueOrThrow({ where: { purchaseId: out.purchaseId } })).status, 'RESERVED')
    })
    throw rollback
  }, { timeout: 120000 }), error => error === rollback)
  stage = 'outer rollback and original counts'
  assert.deepEqual(await counts(), before)
  console.log('REWARD_OPERATIONS_OK: FEFO, snapshots, coupon exclusivity, capped totals, zero/free confirmation, idempotent reserve/consume/restore, owner/status/deadline checks, immutable expiry, complete failure rollback; all Supabase fixtures rolled back')
}
main().catch(error => { const cause = error?.actual ?? error; console.error('Reward operations verification failed at: ' + stage);
  console.error(JSON.stringify({ name: cause?.name, code: cause?.code, model: cause?.meta?.modelName })); process.exitCode = 1 }).finally(disconnectDatabase)
