import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type Prisma } from '../generated/prisma/client'
import { customerRewards, RewardOperationError } from '../server/rewards/operations'
import { rewardFixture, testCheckout, type RewardFixture } from './helpers/reward-fixtures'

// Never use the shared DATABASE_URL: this check commits disposable fixtures for independent sessions.
const value = process.env.REWARD_RACE_DATABASE_URL
if (process.env.REWARD_RACE_TEST_ALLOW_LOCAL !== 'true' || !value) throw new Error('An explicitly enabled isolated local reward test database is required')
const url = new URL(value)
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.pathname !== '/temuevent_reward_test' || url.username !== 'temuevent_app') {
  throw new Error('Race tests only run against the dedicated loopback temuevent_reward_test database')
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 4, ssl: false }) })
const txOptions = { isolationLevel: 'ReadCommitted' as const, timeout: 30000, maxWait: 10000 }
let stage = 'isolated database guard'
const barrier = (size: number) => {
  let count = 0, release!: () => void
  const ready = new Promise<void>(resolve => { release = resolve })
  return async () => { if (++count === size) release(); await ready }
}
const isCode = (r: PromiseSettledResult<unknown>, code: string) => r.status === 'rejected' && r.reason instanceof RewardOperationError && r.reason.code === code
const remaining = async (f: RewardFixture) => {
  const rows = await db.pointGrant.findMany({ where: { userId: f.owner.id, id: { in: f.grants.slice(0, 2).map(g => g.id) } } })
  return rows.reduce((sum, g) => sum + g.remainingAmount, 0n)
}
async function pair<T>(f: RewardFixture, work: (tx: Prisma.TransactionClient, index: number) => Promise<T>) {
  const ready = barrier(2), pids = new Set<number>()
  const result = await Promise.allSettled([0, 1].map(index => db.$transaction(async tx => {
    pids.add((await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`)[0].pid)
    await ready()
    return work(tx, index)
  }, txOptions)))
  assert.equal(pids.size, 2, 'The contenders must use different real PostgreSQL sessions')
  return result
}
async function main() {
  const info = await db.$queryRaw<{ database: string; role: string }[]>`SELECT current_database() AS database, current_user AS role`
  assert.deepEqual(info, [{ database: 'temuevent_reward_test', role: 'temuevent_app' }])
  stage = 'concurrent different purchases cannot double spend points'
  const points = await db.$transaction(tx => rewardFixture(tx, new Date()), txOptions)
  await assert.rejects(customerRewards(db as unknown as Prisma.TransactionClient, points.owner.id),
    (error: unknown) => error instanceof RewardOperationError && error.code === 'TRANSACTION_REQUIRED')
  const pointResults = await pair(points, async tx => testCheckout(tx, points,
    await customerRewards(tx, points.owner.id), { pointsRequested: 15000 }))
  assert.equal(pointResults.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(pointResults.filter(r => isCode(r, 'INSUFFICIENT_POINTS')).length, 1)
  assert.equal(await remaining(points), 5000n)
  assert.equal(await db.purchase.count({ where: { customerId: points.owner.id } }), 1)
  assert.equal((await db.ticketType.findUniqueOrThrow({ where: { id: points.ticket.id } })).availableSeats, 99)

  stage = 'concurrent different purchases cannot both claim one coupon'
  const coupon = await db.$transaction(tx => rewardFixture(tx, new Date()), txOptions)
  const couponResults = await pair(coupon, async tx => testCheckout(tx, coupon,
    await customerRewards(tx, coupon.owner.id), { pointsRequested: 0, couponId: coupon.coupon.id }))
  assert.equal(couponResults.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(couponResults.filter(r => isCode(r, 'COUPON_UNAVAILABLE')).length, 1)
  assert.equal(await db.rewardRedemption.count({ where: { couponId: coupon.coupon.id, status: { in: ['RESERVED', 'CONSUMED'] } } }), 1)

  stage = 'same purchase retry converges to one claim, checkout and inventory decrement'
  const retry = await db.$transaction(tx => rewardFixture(tx, new Date()), txOptions), purchaseId = randomUUID()
  const retryResults = await pair(retry, async tx => testCheckout(tx, retry,
    await customerRewards(tx, retry.owner.id), { purchaseId, pointsRequested: 12000, couponId: retry.coupon.id }))
  assert.equal(retryResults.filter(r => r.status === 'fulfilled').length, 2)
  assert.equal(await remaining(retry), 8000n)
  assert.equal(await db.purchase.count({ where: { customerId: retry.owner.id } }), 1)
  assert.equal(await db.rewardRedemption.count({ where: { purchaseId } }), 1)
  assert.equal((await db.ticketType.findUniqueOrThrow({ where: { id: retry.ticket.id } })).availableSeats, 99)

  stage = 'overlapping restoration returns allocations exactly once'
  await db.purchase.update({ where: { id: purchaseId }, data: { status: 'REJECTED' } })
  const restored = await pair(retry, async tx => (await customerRewards(tx, retry.owner.id)).restore(purchaseId))
  assert.equal(restored.filter(r => r.status === 'fulfilled').length, 2)
  assert.equal(await remaining(retry), 20000n)
  assert.equal((await db.rewardRedemption.findUniqueOrThrow({ where: { purchaseId } })).status, 'RESTORED')

  stage = 'overlapping consumption does not deduct reserved points twice'
  const consumed = await db.$transaction(tx => rewardFixture(tx, new Date()), txOptions)
  const purchase = await db.$transaction(async tx => {
    const out = await testCheckout(tx, consumed, await customerRewards(tx, consumed.owner.id), { pointsRequested: 12000 })
    await tx.purchase.update({ where: { id: out.purchaseId }, data: { status: 'DONE', completedAt: new Date() } })
    return out
  }, txOptions)
  const consumption = await pair(consumed, async tx => (await customerRewards(tx, consumed.owner.id)).consume(purchase.purchaseId))
  assert.equal(consumption.filter(r => r.status === 'fulfilled').length, 2)
  assert.equal(await remaining(consumed), 8000n)
  assert.equal((await db.rewardRedemption.findUniqueOrThrow({ where: { purchaseId: purchase.purchaseId } })).status, 'CONSUMED')

  stage = 'a failed overlapping reservation rolls back before the waiting checkout proceeds'
  const failure = await db.$transaction(tx => rewardFixture(tx, new Date()), txOptions)
  let firstReady!: () => void, secondReady!: () => void
  const ready = new Promise<void>(resolve => { firstReady = resolve })
  const started = new Promise<void>(resolve => { secondReady = resolve })
  const fault = new Error('INJECTED_RACING_CHECKOUT_FAILURE')
  const first = db.$transaction(async tx => {
    const rewards = await customerRewards(tx, failure.owner.id)
    await testCheckout(tx, failure, rewards, { pointsRequested: 12000 })
    firstReady(); await started; throw fault
  }, txOptions)
  // Observe rejection immediately so a failing contender cannot become an unhandled rejection.
  const firstResult = first.then(value => ({ status: 'fulfilled' as const, value }), reason => ({ status: 'rejected' as const, reason }))
  await Promise.race([ready, firstResult.then(result => { if (result.status === 'rejected') throw result.reason })])
  const second = db.$transaction(async tx => {
    secondReady()
    return testCheckout(tx, failure, await customerRewards(tx, failure.owner.id), { pointsRequested: 15000 })
  }, txOptions)
  const [failed, successful] = await Promise.all([firstResult, second])
  assert.equal(failed.status, 'rejected'); if (failed.status === 'rejected') assert.equal(failed.reason, fault)
  assert.equal(successful.result.status, 'RESERVED'); assert.equal(await remaining(failure), 5000n)
  assert.equal(await db.purchase.count({ where: { customerId: failure.owner.id } }), 1)
  assert.equal((await db.ticketType.findUniqueOrThrow({ where: { id: failure.ticket.id } })).availableSeats, 99)
  console.log('REWARD_RACES_OK: six scenarios, separate PostgreSQL sessions; no double points/coupon claims, duplicate checkout, double restoration/consumption or leaked failed-reservation writes. Only isolated local fixtures were committed.')
}
main().catch(error => { console.error('Reward race verification failed at: ' + stage);
  console.error(JSON.stringify({ name: error?.name, code: error?.code })); process.exitCode = 1 }).finally(() => db.$disconnect())
