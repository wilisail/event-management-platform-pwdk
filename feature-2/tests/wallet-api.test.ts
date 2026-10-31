import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import { createApp } from '../server/app'
import type { RewardReadRepository, WalletQuery } from '../server/rewards/reads'
import { sessionFixture, loginFields, testAccount } from './helpers/sessions'

function fixture() {
  const session = sessionFixture()
  const calls: { actor: string; query?: WalletQuery; asOf?: string }[] = []
  const repository: RewardReadRepository = {
    async countReferrals(actor) { calls.push({ actor }); return 2 },
    async wallet(actor, now, query) {
      calls.push({ actor, query, asOf: now.toISOString() })
      const page = (value: number) => ({ items: [], pagination: { page: value, pageSize: query.pageSize, total: 0, totalPages: 0 } })
      return { userId: actor, asOf: now.toISOString(), currency: 'IDR', availablePoints: 0,
        availableCouponCount: 0, pointValueIdr: 1, pointGrants: page(query.pointPage), coupons: page(query.couponPage) }
    },
  }
  return { ...session, calls, repository }
}

async function serve(f: ReturnType<typeof fixture>, work: (get: (path: string, cookie?: string) => Promise<Response>) => Promise<void>, configured = true) {
  const server = createApp({ sessionService: f.service, now: f.now,
    rewardRepository: configured ? f.repository : undefined }).listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing test port')
  const base = 'http://127.0.0.1:' + address.port
  const get = (path: string, cookie?: string) => fetch(base + path, { headers: {
    ...(cookie ? { cookie } : {}), 'x-demo-persona': 'customer', 'x-user-id': 'another-account',
  } })
  try { await work(get) } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
}
const cookie = (token: string) => 'temuevent_access=' + token

test('real reward routes require a verified session, never demo identity', async () => {
  const f = fixture()
  await serve(f, async get => {
    for (const path of ['/api/me/rewards', '/api/me/referral']) {
      for (const auth of [undefined, cookie('forged.jwt.token')]) {
        const r = await get(path, auth)
        assert.equal(r.status, 401); assert.equal(r.headers.get('cache-control'), 'no-store')
      }
    }
    assert.equal(f.calls.length, 0)
  })
})

test('wallet uses session owner, bounded pages and server time with no public caching', async () => {
  const f = fixture(), auth = await f.service.login(loginFields)
  await serve(f, async get => {
    const r = await get('/api/me/rewards?pointPage=2&couponPage=3&pageSize=5', cookie(auth.accessToken))
    assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store')
    const data = (await r.json()).data
    assert.equal(data.userId, testAccount.id); assert.equal(data.availablePoints, 0)
    assert.deepEqual(f.calls, [{ actor: testAccount.id, asOf: f.now().toISOString(), query: { pointPage: 2, couponPage: 3, pageSize: 5 } }])
    const ref = await get('/api/me/referral', cookie(auth.accessToken))
    assert.deepEqual((await ref.json()).data, { code: testAccount.referralCode, referredCount: 2, referralAwardPoints: 10000, validityCalendarMonths: 3 })
  })
})

test('reward query validation rejects owner/time injection, arrays and unbounded pages', async () => {
  const f = fixture(), auth = await f.service.login(loginFields)
  await serve(f, async get => {
    for (const query of ['userId=someone-else', 'asOf=2099-01-01', 'pointPage=0', 'couponPage=1001',
      'pointPage=1.5', 'pageSize=51', 'pageSize=-1', 'pointPage=1&pointPage=2']) {
      assert.equal((await get('/api/me/rewards?' + query, cookie(auth.accessToken))).status, 400, query)
    }
    assert.equal((await get('/api/me/referral?userId=someone-else', cookie(auth.accessToken))).status, 400)
    assert.equal(f.calls.length, 0)
  })
})

test('organizers can read their referral summary but cannot use the customer wallet', async () => {
  const f = fixture(); f.users.get(testAccount.email)!.role = 'ORGANIZER'
  const auth = await f.service.login(loginFields)
  await serve(f, async get => {
    assert.equal((await get('/api/me/rewards', cookie(auth.accessToken))).status, 403)
    assert.equal((await get('/api/me/referral', cookie(auth.accessToken))).status, 200)
    assert.deepEqual(f.calls, [{ actor: testAccount.id }])
  })
})

test('revoked sessions cannot read rewards even with an unexpired signed access token', async () => {
  const f = fixture(), auth = await f.service.login(loginFields)
  await f.service.logout(auth.refreshToken)
  await serve(f, async get => {
    for (const path of ['/api/me/rewards', '/api/me/referral']) assert.equal((await get(path, cookie(auth.accessToken))).status, 401)
    assert.equal(f.calls.length, 0)
  })
})

test('missing or failed reward storage returns a sanitized error, not a fake zero balance', async () => {
  const f = fixture(), auth = await f.service.login(loginFields)
  await serve(f, async get => {
    for (const path of ['/api/me/rewards', '/api/me/referral']) assert.equal((await get(path, cookie(auth.accessToken))).status, 503)
  }, false)
  f.repository.wallet = f.repository.countReferrals = async () => { throw new Error('private database credential') }
  await serve(f, async get => {
    for (const path of ['/api/me/rewards', '/api/me/referral']) {
      const r = await get(path, cookie(auth.accessToken)), body = await r.json()
      assert.equal(r.status, 503); assert.equal(body.code, 'REWARDS_UNAVAILABLE')
      assert.equal(JSON.stringify(body).includes('private database credential'), false)
      assert.equal(body.data, undefined)
    }
  })
})
