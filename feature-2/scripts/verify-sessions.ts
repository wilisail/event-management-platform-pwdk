import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createApp } from '../server/app'
import { databaseClient, disconnectDatabase } from '../server/database'
import { createRegistrationService } from '../server/auth/registration'
import { prismaRegistrationRepository } from '../server/auth/registration-repository'
import { createSessionService } from '../server/auth/sessions'
import { prismaSessionRepository } from '../server/auth/session-repository'
import { createSessionTokens, hashRefreshToken, ACCESS_SECONDS, SESSION_SECONDS } from '../server/auth/session-tokens'

const db = databaseClient()
const rollback = new Error('ROLLBACK_SESSION_CHECK')
const email = 'session-check-' + randomUUID() + '@example.test'
let currentCheck = 'connection'

async function main() {
  await assert.rejects(db.$transaction(async tx => {
    let time = new Date()
    const now = () => new Date(time)
    const service = createSessionService({ repository: prismaSessionRepository(tx, work => work(tx)),
      tokens: createSessionTokens(randomBytes(32).toString('hex')), now })
    const server = createApp({ sessionService: service, now, secureCookies: false,
      registrationService: createRegistrationService({ repository: prismaRegistrationRepository(tx) }),
    }).listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Missing port')
    const base = 'http://127.0.0.1:' + address.port
    const post = (path: string, body: unknown, cookie = '', csrf = '') => fetch(base + '/api/auth/' + path, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3001',
        'x-temuevent-client': 'web', cookie, 'x-csrf-token': csrf }, body: JSON.stringify(body),
    })
    const get = (path: string, cookie = '') => fetch(base + '/api/auth/' + path, { headers: { cookie } })
    const cookieHeader = (res: Response) => res.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
    const refreshSecret = (res: Response) => res.headers.getSetCookie()
      .find(value => value.startsWith('temuevent_refresh='))!.split(';')[0].split('=')[1]
    const password = randomBytes(24).toString('base64url')
    try {
      currentCheck = 'register through real HTTP'
      const registration = await post('register', { name: 'Session Verification', email, password })
      assert.equal(registration.status, 201)
      const account = (await registration.json()).data.user
      const fields = { email: ' ' + email.toUpperCase() + ' ', password }
      currentCheck = 'reject wrong password without session'
      assert.equal((await post('login', { ...fields, password: 'incorrect' })).status, 401)
      assert.equal(await tx.authSession.count({ where: { userId: account.id } }), 0)

      currentCheck = 'login writes a real session and hashed refresh secret'
      const login = await post('login', fields)
      assert.equal(login.status, 200)
      const value = await login.json(), originalCookie = cookieHeader(login)
      assert.equal('accessToken' in value.data, false)
      assert.equal('refreshToken' in value.data, false)
      const stored = await tx.authSession.findFirstOrThrow({ where: { userId: account.id }, include: { refreshTokens: true } })
      assert.equal(stored.refreshTokens.length, 1)
      assert.equal(stored.refreshTokens[0].tokenHash, hashRefreshToken(refreshSecret(login)))
      assert.equal(stored.refreshTokens[0].tokenHash === refreshSecret(login), false)
      assert.equal((await get('session', originalCookie)).status, 200)
      assert.equal((await get('session')).status, 401)
      assert.equal((await post('refresh', {}, originalCookie)).status, 403)

      currentCheck = 'expired access can refresh; expiry remains absolute'
      time = new Date(time.getTime() + ACCESS_SECONDS * 1000)
      assert.equal((await get('session', originalCookie)).status, 401)
      const renewed = await post('refresh', {}, originalCookie, value.data.csrfToken)
      assert.equal(renewed.status, 200)
      const next = await renewed.json(), nextCookie = cookieHeader(renewed)
      assert.equal(next.data.sessionExpiresAt, value.data.sessionExpiresAt)
      assert.notEqual(refreshSecret(renewed), refreshSecret(login))
      assert.equal((await get('session', nextCookie)).status, 200)
      assert.equal(await tx.authRefreshToken.count({ where: { sessionId: stored.id } }), 2)
      assert((await tx.authRefreshToken.findUniqueOrThrow({ where: { tokenHash: hashRefreshToken(refreshSecret(login)) } })).consumedAt)

      currentCheck = 'old refresh replay commits revocation and invalidates new access'
      assert.equal((await post('refresh', {}, originalCookie, value.data.csrfToken)).status, 401)
      assert((await tx.authSession.findUniqueOrThrow({ where: { id: stored.id } })).revokedAt)
      assert.equal((await get('session', nextCookie)).status, 401)
      assert.equal((await post('refresh', {}, nextCookie, next.data.csrfToken)).status, 401)

      currentCheck = 'logout revokes only its session and clears cookies'
      const second = await post('login', fields), secondBody = await second.json(), secondCookie = cookieHeader(second)
      const third = await post('login', fields), thirdBody = await third.json(), thirdCookie = cookieHeader(third)
      const logout = await post('logout', {}, secondCookie, secondBody.data.csrfToken)
      assert.equal(logout.status, 200)
      assert(logout.headers.getSetCookie().every(header => header.includes('Expires=Thu, 01 Jan 1970')))
      assert.equal((await get('session', secondCookie)).status, 401)
      assert.equal((await get('session', thirdCookie)).status, 200)
      assert.equal((await post('logout', {})).status, 200)

      currentCheck = 'absolute seven-day session expiry'
      time = new Date(time.getTime() + SESSION_SECONDS * 1000)
      assert.equal((await post('refresh', {}, thirdCookie, thirdBody.data.csrfToken)).status, 401)
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
    throw rollback
  }, { timeout: 45000 }), error => error === rollback)
  currentCheck = 'rollback cleanup'
  assert.equal(await db.user.count({ where: { email } }), 0)
  console.log(JSON.stringify({ passed: [
    'Real HTTP registration/login -> scrypt verification -> Prisma -> Supabase',
    'Session and refresh SHA-256 digest persisted; raw tokens excluded from JSON',
    'Access expiry, refresh rotation and absolute expiry enforced using a test clock',
    'Used-refresh replay commits session revocation; existing access is rejected',
    'CSRF rejection, logout/cookie clearing and isolation between separate logins',
    'Temporary user, sessions and refresh history all rolled back',
  ], boundary: 'Sequential live database checks. Concurrent refresh policy is also unit-tested; browser UI and reusable role middleware are subsequent batches.' }, null, 2))
}

main().catch(() => {
  console.error('Session verification failed at: ' + currentCheck)
  process.exitCode = 1
}).finally(disconnectDatabase)
