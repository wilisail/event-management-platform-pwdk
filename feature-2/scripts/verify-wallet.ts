import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createApp } from '../server/app'
import { databaseClient, disconnectDatabase } from '../server/database'
import { createRegistrationService } from '../server/auth/registration'
import { prismaRegistrationRepository } from '../server/auth/registration-repository'
import { createSessionService } from '../server/auth/sessions'
import { prismaSessionRepository } from '../server/auth/session-repository'
import { createSessionTokens } from '../server/auth/session-tokens'
import { prismaRewardReadRepository } from '../server/rewards/read-repository'
import { registrationSavepoints } from './helpers/registration-transaction'
import { addCalendarMonths } from '../domain/rewards'

const db = databaseClient(), rollback = new Error('ROLLBACK_WALLET_CHECK'), tag = randomUUID()
const emails: string[] = []
let stage = 'baseline'
async function main() {
  const counts = () => Promise.all([db.user.count(), db.referral.count(), db.pointGrant.count(), db.rewardCoupon.count(),
    db.purchase.count(), db.authSession.count(), db.authRefreshToken.count(), db.rewardRedemption.count(), db.pointAllocation.count()])
  const before = await counts()
  await assert.rejects(db.$transaction(async tx => {
    const at = new Date(), password = randomBytes(24).toString('base64url')
    let clock = at
    const now = () => new Date(clock)
    const registration = createRegistrationService({ repository: prismaRegistrationRepository(tx, registrationSavepoints(tx)),
      now, referralCouponIdr: 17500 })
    const sessions = createSessionService({ repository: prismaSessionRepository(tx, work => work(tx)),
      tokens: createSessionTokens(randomBytes(32).toString('hex')), now })
    const repository = prismaRewardReadRepository(tx, work => work(tx))
    const server = createApp({ registrationService: registration, sessionService: sessions,
      rewardRepository: repository, now, registrationRateLimit: { limit: 30, windowMs: 60000 } }).listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Missing test port')
    const base = 'http://127.0.0.1:' + address.port
    const post = (path: string, body: unknown) => fetch(base + path, { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-temuevent-client': 'web', origin: 'http://localhost:3001' },
      body: JSON.stringify(body) })
    const signup = async (label: string, referralCode?: string) => {
      const email = 'wallet-' + label + '-' + tag + '@example.test'; emails.push(email)
      const r = await post('/api/auth/register', { name: 'Wallet ' + label, email, password, referralCode })
      assert.equal(r.status, 201)
      return (await r.json()).data.user as { id: string; email: string; referralCode: string }
    }
    const login = async (email: string) => {
      const r = await post('/api/auth/login', { email, password })
      assert.equal(r.status, 200)
      return r.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
    }
    const get = (path: string, cookie: string) => fetch(base + path, { headers: { cookie, 'x-user-id': 'ignored' } })
    try {
      stage = 'real signup, login and empty wallet'
      const referrer = await signup('inviter'), ownerCookie = await login(referrer.email)
      const empty = await get('/api/me/rewards', ownerCookie)
      assert.equal(empty.status, 200); assert.equal(empty.headers.get('cache-control'), 'no-store')
      const emptyWallet = (await empty.json()).data
      assert.equal(emptyWallet.availablePoints, 0); assert.equal(emptyWallet.availableCouponCount, 0)
      assert.deepEqual(emptyWallet.pointGrants.items, []); assert.deepEqual(emptyWallet.coupons.items, [])

      stage = 'referral signup is immediately reflected in each authenticated wallet'
      const newcomers: { id: string; email: string; referralCode: string }[] = []
      for (const name of ['available', 'reserved', 'used', 'restored', 'expired']) newcomers.push(await signup(name, referrer.referralCode))
      const bundles = await tx.referral.findMany({ where: { referrerId: referrer.id }, include: { pointGrant: true, rewardCoupon: true } })
      const bundleFor = (id: string) => bundles.find(row => row.referredUserId === id)!
      const plainWallet = (await (await get('/api/me/rewards', ownerCookie)).json()).data
      assert.equal(plainWallet.availablePoints, 50000)
      assert.deepEqual((await (await get('/api/me/referral', ownerCookie)).json()).data,
        { code: referrer.referralCode, referredCount: 5, referralAwardPoints: 10000, validityCalendarMonths: 3 })
      const firstCookie = await login(newcomers[0].email)
      const firstWallet = (await (await get('/api/me/rewards', firstCookie)).json()).data
      assert.equal(firstWallet.availablePoints, 0); assert.equal(firstWallet.availableCouponCount, 1)
      assert.equal(firstWallet.coupons.items[0].discountValue, 17500)
      assert.equal(firstWallet.coupons.items[0].expiresAt, addCalendarMonths(at, 3).toISOString())
      assert.deepEqual(firstWallet.pointGrants.items, [])

      stage = 'fixture active claims, reserved point allocations, exact-expiry and future earning batches'
      const ticket = await tx.ticketType.findFirstOrThrow({ select: { id: true, eventId: true } })
      const claim = async (userId: string, status: 'RESERVED' | 'CONSUMED' | 'RESTORED', couponId?: string, points = 0n) => {
        const couponDiscount = couponId ? 17500n : 0n
        const purchase = await tx.purchase.create({ data: { reference: 'WALLET-CHECK-' + randomUUID(), customerId: userId,
          eventId: ticket.eventId, status: status === 'CONSUMED' ? 'DONE' : status === 'RESTORED' ? 'REJECTED' : 'WAITING_FOR_PAYMENT',
          subtotal: 50000n, totalPrice: 50000n - points - couponDiscount, pointsUsed: points, couponDiscount,
          ...(status === 'RESERVED' ? { paymentDueAt: new Date(at.getTime() + 7200000) } : {}),
          ...(status === 'CONSUMED' ? { completedAt: at } : {}) } })
        await tx.purchaseItem.create({ data: { eventId: ticket.eventId, purchaseId: purchase.id,
          ticketTypeId: ticket.id, quantity: 1, unitPrice: 50000n, lineTotal: 50000n } })
        return tx.rewardRedemption.create({ data: { userId, purchaseId: purchase.id, couponId,
          pointsUsed: points, couponDiscount, status, reservedAt: at,
          consumedAt: status === 'CONSUMED' ? at : null, restoredAt: status === 'RESTORED' ? at : null } })
      }
      const firstGrant = bundleFor(newcomers[0].id).pointGrant!
      stage = 'fixture held point purchase and allocation'
      const holding = await claim(referrer.id, 'RESERVED', undefined, 4000n)
      await tx.pointAllocation.create({ data: { userId: referrer.id, redemptionId: holding.id, pointGrantId: firstGrant.id, amount: 4000n } })
      await tx.pointGrant.update({ where: { id: firstGrant.id }, data: { remainingAmount: 6000n } })
      stage = 'fixture point expiry boundary'
      await tx.pointGrant.update({ where: { id: bundleFor(newcomers[2].id).pointGrant!.id }, data: {
        creditedAt: new Date(at.getTime() - 1000), expiresAt: at } })
      await tx.pointGrant.update({ where: { id: bundleFor(newcomers[3].id).pointGrant!.id }, data: {
        creditedAt: new Date(at.getTime() + 1), expiresAt: addCalendarMonths(at, 3) } })
      const spentGrant = bundleFor(newcomers[4].id).pointGrant!
      stage = 'fixture spent point purchase and allocation'
      const spent = await claim(referrer.id, 'CONSUMED', undefined, 10000n)
      await tx.pointAllocation.create({ data: { userId: referrer.id, redemptionId: spent.id, pointGrantId: spentGrant.id, amount: 10000n } })
      await tx.pointGrant.update({ where: { id: spentGrant.id }, data: { remainingAmount: 0n } })
      stage = 'fixture reserved coupon'
      await claim(newcomers[1].id, 'RESERVED', bundleFor(newcomers[1].id).rewardCoupon!.id)
      stage = 'fixture used coupon'
      await claim(newcomers[2].id, 'CONSUMED', bundleFor(newcomers[2].id).rewardCoupon!.id)
      stage = 'fixture restored coupon'
      await claim(newcomers[3].id, 'RESTORED', bundleFor(newcomers[3].id).rewardCoupon!.id)

      stage = 'summary covers all pages and excludes held, spent, expired and future points'
      const seen = new Set<string>()
      for (let page = 1; page <= 3; page++) {
        const r = await get('/api/me/rewards?pointPage=' + page + '&pageSize=2', ownerCookie)
        assert.equal(r.status, 200)
        const wallet = (await r.json()).data
        assert.equal(wallet.availablePoints, 16000); assert.equal(wallet.pointGrants.pagination.total, 5)
        for (const row of wallet.pointGrants.items) { assert.equal(seen.has(row.id), false); seen.add(row.id) }
        assert.deepEqual(wallet.coupons.items, [])
      }
      assert.equal(seen.size, 5)

      stage = 'coupon availability reflects active and restored claims without exposing other accounts'
      for (let i = 0; i < newcomers.length; i++) {
        const user = newcomers[i]
        const auth = i === 0 ? firstCookie : await login(user.email)
        const wallet = (await (await get('/api/me/rewards', auth)).json()).data
        assert.equal(wallet.userId, user.id); assert.equal(wallet.coupons.items.length, 1)
        assert.equal(wallet.coupons.items[0].status, ['AVAILABLE', 'RESERVED', 'USED', 'AVAILABLE', 'AVAILABLE'][i])
        assert.equal(wallet.availableCouponCount, [1, 0, 0, 1, 1][i])
        assert.equal(JSON.stringify(wallet).includes(referrer.email), false)
        assert.equal(wallet.coupons.items[0].referralId, undefined)
      }
      stage = 'read-time expiry and future activation use server instant, without a cron mutation'
      // Coupon terms are immutable to the backend role: move the QA clock, never edit an award.
      clock = addCalendarMonths(at, 3)
      const expiredCookie = await login(newcomers[4].email)
      const expired = (await (await get('/api/me/rewards', expiredCookie)).json()).data
      assert.equal(expired.availableCouponCount, 0); assert.equal(expired.coupons.items[0].status, 'EXPIRED')
      assert.equal(expired.asOf, expired.coupons.items[0].expiresAt)
      assert.equal((await tx.rewardCoupon.findUniqueOrThrow({ where: { id: bundleFor(newcomers[4].id).rewardCoupon!.id } })).issuedAt.toISOString(), at.toISOString())
      clock = new Date(at.getTime() + 1)
      const future = await signup('future', referrer.referralCode)
      clock = at
      const futureCookie = await login(future.email)
      const pending = (await (await get('/api/me/rewards', futureCookie)).json()).data
      assert.equal(pending.availableCouponCount, 0); assert.equal(pending.coupons.items[0].status, 'PENDING')
      assert.equal(await tx.rewardCoupon.count({ where: { userId: future.id } }), 1)
    } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
    throw rollback
  }, { isolationLevel: 'RepeatableRead', timeout: 120000 }), error => error === rollback)
  stage = 'rollback and original database counts'
  assert.equal(await db.user.count({ where: { email: { in: emails } } }), 0)
  assert.deepEqual(await counts(), before)
  console.log('WALLET_READS_OK: real signup/login; owner-bound wallets/referral counts; all-page balance; reserved/spent/expired/future points; available/reserved/used/restored/expired/future coupons; private fields absent; QA rolled back')
}
main().catch(error => {
  const cause = error?.actual ?? error
  console.error('Wallet verification failed at: ' + stage)
  console.error(JSON.stringify({ name: cause?.name, code: cause?.code, model: cause?.meta?.modelName,
    driverCode: cause?.meta?.driverAdapterError?.cause?.originalCode,
    constraint: cause?.meta?.driverAdapterError?.cause?.constraint }))
  process.exitCode = 1
}).finally(disconnectDatabase)
