import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createApp } from '../server/app'
import { databaseClient, disconnectDatabase } from '../server/database'
import { createRegistrationService } from '../server/auth/registration'
import { prismaRegistrationRepository, type RegistrationTransaction } from '../server/auth/registration-repository'
import { verifyPassword } from '../server/auth/passwords'
import { addCalendarMonths } from '../domain/rewards'
import { registrationSavepoints } from './helpers/registration-transaction'

const db = databaseClient(), rollback = new Error('ROLLBACK_REFERRAL_REGISTRATION_CHECK')
const tag = randomUUID(), emails: string[] = []
let stage = 'baseline'
async function main() {
  const before = await Promise.all([db.user.count(), db.referral.count(), db.pointGrant.count(), db.rewardCoupon.count(), db.purchase.count()])
  await assert.rejects(db.$transaction(async tx => {
    const referrer = await tx.user.findUniqueOrThrow({ where: { email: 'ayu@example.test' } })
    const at = new Date(), password = randomBytes(24).toString('base64url')
    let failure: 'referral' | 'pointGrant' | 'rewardCoupon' | undefined
    let couponNumber = 0, collide = false, collisions = 0
    const firstCoupon = 'REF-' + tag.replaceAll('-', '').slice(0, 20).toUpperCase()
    const savepoint = registrationSavepoints(tx)
    const transaction: RegistrationTransaction = work => savepoint(connection => work(new Proxy(connection, {
      get(target, key) {
        const delegate = Reflect.get(target, key)
        if (key !== failure) return delegate
        return new Proxy(delegate, { get(value, method) {
          if (method === 'create') return () => { throw new Error('INJECTED_ISSUANCE_FAILURE') }
          return Reflect.get(value, method)
        } })
      },
    })))
    const service = createRegistrationService({ repository: prismaRegistrationRepository(tx, transaction), now: () => at,
      referralCouponIdr: 17500, couponCodeGenerator: () => {
        if (collide && collisions++ === 0) return firstCoupon
        return couponNumber++ === 0 ? firstCoupon : 'REF-' + randomBytes(10).toString('hex').toUpperCase()
      },
    })
    const server = createApp({ registrationService: service,
      registrationRateLimit: { limit: 50, windowMs: 60000 } }).listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Missing test port')
    const base = 'http://127.0.0.1:' + address.port
    const input = (label: string, referralCode: string | undefined = referrer.referralCode.toLowerCase()) => {
      const email = 'referral-' + label + '-' + tag + '@example.test'
      if (!emails.includes(email)) emails.push(email)
      return { name: 'Referral ' + label, email, password, ...(referralCode ? { referralCode: ' ' + referralCode + ' ' } : {}) }
    }
    const post = (body: unknown) => fetch(base + '/api/auth/register', { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-temuevent-client': 'web', origin: 'http://localhost:3001' }, body: JSON.stringify(body) })
    const counts = () => Promise.all([tx.user.count(), tx.referral.count(), tx.pointGrant.count(), tx.rewardCoupon.count()])
    try {
      stage = 'real HTTP referral signup and safe response'
      const request = input('valid'), response = await post(request), body = await response.json()
      assert.equal(response.status, 201)
      assert.equal(response.headers.get('set-cookie'), null)
      assert.deepEqual(Object.keys(body.data.user).sort(), ['id', 'name', 'email', 'role', 'referralCode', 'profilePictureUrl'].sort())
      assert.equal(body.data.user.email, request.email)
      const account = await tx.user.findUniqueOrThrow({ where: { email: request.email } })
      assert.equal(await verifyPassword(password, account.passwordHash!), true)
      const bundle = await tx.referral.findUniqueOrThrow({ where: { referredUserId: account.id }, include: { pointGrant: true, rewardCoupon: true } })
      assert.equal(bundle.referrerId, referrer.id)
      assert.equal(bundle.pointGrant?.userId, referrer.id)
      assert.equal(bundle.pointGrant?.amount, 10000n)
      assert.equal(bundle.pointGrant?.remainingAmount, 10000n)
      assert.equal(bundle.rewardCoupon?.userId, account.id)
      assert.equal(bundle.rewardCoupon?.discountValue, 17500n)
      assert.equal(bundle.pointGrant?.expiresAt.toISOString(), addCalendarMonths(at, 3).toISOString())
      assert.equal(bundle.rewardCoupon?.expiresAt.toISOString(), addCalendarMonths(at, 3).toISOString())
      assert.equal(await tx.authSession.count({ where: { userId: account.id } }), 0)

      stage = 'duplicate replay issues no second rewards'
      const initial = await counts()
      const duplicate = await post({ ...request, email: request.email.toUpperCase() })
      assert.equal(duplicate.status, 409)
      assert.equal((await duplicate.json()).code, 'EMAIL_IN_USE')
      assert.deepEqual(await counts(), initial)

      stage = 'invalid referral rolls back without account creation'
      const invalid = await post(input('invalid', 'UNKNOWN123'))
      assert.equal(invalid.status, 400)
      assert.equal((await invalid.json()).code, 'INVALID_REFERRAL_CODE')
      assert.deepEqual(await counts(), initial)

      stage = 'failures after user, referral and point writes roll back all related rows'
      for (const fault of ['referral', 'pointGrant', 'rewardCoupon'] as const) {
        failure = fault
        const failedInput = input('failed-' + fault), snapshot = await counts()
        const failed = await post(failedInput)
        assert.equal(failed.status, 503)
        assert.equal(JSON.stringify(await failed.json()).includes('INJECTED'), false)
        assert.equal(await tx.user.count({ where: { email: failedInput.email } }), 0)
        assert.deepEqual(await counts(), snapshot)
        failure = undefined
      }

      stage = 'same email can register after a rolled-back failure'
      const recovered = await post(input('failed-rewardCoupon'))
      assert.equal(recovered.status, 201)
      const recoveredUser = (await recovered.json()).data.user
      assert.equal(await tx.referral.count({ where: { referredUserId: recoveredUser.id } }), 1)

      stage = 'real unique coupon collision rolls back and retries only the new bundle'
      collide = true
      const prior = await counts(), retry = await post(input('collision'))
      assert.equal(retry.status, 201)
      assert.equal(collisions, 2)
      assert.deepEqual(await counts(), prior.map(value => value + 1))
      const firstAgain = await tx.rewardCoupon.findUniqueOrThrow({ where: { code: firstCoupon } })
      assert.equal(firstAgain.userId, account.id)

      stage = 'optional referral still creates only a normal account'
      collide = false
      const plainBefore = await counts(), plain = await post(input('plain', ''))
      assert.equal(plain.status, 201)
      assert.deepEqual(await counts(), [plainBefore[0] + 1, ...plainBefore.slice(1)])
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
    throw rollback
  }, { timeout: 60000 }), error => error === rollback)
  stage = 'outer rollback and original database baseline'
  assert.equal(await db.user.count({ where: { email: { in: emails } } }), 0)
  const after = await Promise.all([db.user.count(), db.referral.count(), db.pointGrant.count(), db.rewardCoupon.count(), db.purchase.count()])
  assert.deepEqual(after, before)
  console.log('REFERRAL_REGISTRATION_OK: HTTP signup, correct recipients, 10000 points, configured coupon, three-month expiry, replay protection, injected-failure rollback, coupon collision retry, optional signup; baseline preserved')
}
main().catch(() => { console.error('Referral registration verification failed at: ' + stage); process.exitCode = 1 }).finally(disconnectDatabase)
