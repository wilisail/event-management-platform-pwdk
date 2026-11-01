import assert from 'node:assert/strict'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import sharp from 'sharp'
import { createApp } from '../server/app'
import { databaseClient, disconnectDatabase } from '../server/database'
import { createRegistrationService } from '../server/auth/registration'
import { prismaRegistrationRepository } from '../server/auth/registration-repository'
import { createSessionService } from '../server/auth/sessions'
import { prismaSessionRepository } from '../server/auth/session-repository'
import { createSessionTokens } from '../server/auth/session-tokens'
import { createPasswordChangeService } from '../server/auth/change-password'
import { prismaPasswordRepository } from '../server/auth/password-repository'
import { createPasswordResetService } from '../server/auth/password-reset'
import { prismaResetRepository } from '../server/auth/reset-repository'
import { createProfileService } from '../server/profile/service'
import { prismaProfileRepository } from '../server/profile/repository'
import { normalizePicture } from '../server/profile/pictures'
import { prismaRewardReadRepository } from '../server/rewards/read-repository'
import { prismaOrganizerReadRepository } from '../server/organizer/read-repository'
import { registrationSavepoints } from './helpers/registration-transaction'
import type { EmailMessage } from '../server/email/resend'

// QA-only: all writes share one outer SQL transaction and roll back, including failures.
// File/mail transports are explicit memory fixtures; real SQL, image processing and scrypt remain active.
const db = databaseClient(), rollback = new Error('ROLLBACK_ACCOUNT_REGRESSION'), tag = randomUUID()
let stage = 'baseline'
async function snapshot() {
  const counts = await Promise.all([db.user.count(), db.event.count(), db.purchase.count(), db.referral.count(),
    db.pointGrant.count(), db.rewardCoupon.count(), db.authSession.count(), db.authRefreshToken.count(), db.passwordResetToken.count()])
  const users = createHash('sha256').update(JSON.stringify(await db.user.findMany({ orderBy: { id: 'asc' } }))).digest('hex')
  return { counts, users }
}
async function main() {
  const before = await snapshot()
  await db.$transaction(async tx => {
    const atomic = registrationSavepoints(tx), mail: EmailMessage[] = [], files = new Map<string, Buffer>()
    const signingSecret = randomBytes(32).toString('hex')
    const registration = createRegistrationService({ repository: prismaRegistrationRepository(tx, atomic) })
    const sessions = createSessionService({ repository: prismaSessionRepository(tx, work => atomic(() => work(tx))), tokens: createSessionTokens(signingSecret) })
    const profiles = createProfileService({ repository: prismaProfileRepository(tx, work => atomic(() => work(tx))), normalize: normalizePicture,
      storage: { async upload(key, bytes) { files.set(key, bytes) }, async download(key) { assert(files.has(key)); return files.get(key)! }, async remove(key) { files.delete(key) } } })
    const recovery = createPasswordResetService({ repository: prismaResetRepository(tx, work => atomic(() => work(tx))), signingSecret,
      origin: 'https://temuevent.example', mailer: { async send(message) { mail.push(message) } } })
    const server = createApp({ registrationService: registration, sessionService: sessions, profileService: profiles,
      passwordChangeService: createPasswordChangeService({ repository: prismaPasswordRepository(tx, work => atomic(() => work(tx))) }),
      passwordResetService: recovery, organizerRepository: prismaOrganizerReadRepository(tx),
      rewardRepository: prismaRewardReadRepository(tx, work => work(tx)), secureCookies: false,
      registrationRateLimit: { limit: 100, windowMs: 60000 }, loginRateLimit: { limit: 100, windowMs: 60000 },
      passwordChangeLimit: { limit: 100, windowMs: 60000 }, passwordResetLimit: { limit: 100, windowMs: 60000 },
    }).listen(0, '127.0.0.1')
    await once(server, 'listening'); const address = server.address(); assert(address && typeof address !== 'string')
    const base = 'http://127.0.0.1:' + address.port, password = randomBytes(24).toString('hex')
    const request = (path: string, method = 'GET', input?: unknown, extra: Record<string, string> = {}) => fetch(base + '/api/' + path, {
      method, headers: { 'x-temuevent-client': 'web', ...(input === undefined ? {} : { 'content-type': 'application/json' }), ...extra },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
    })
    const login = async (email: string, value: string) => {
      const response = await request('auth/login', 'POST', { email, password: value }); assert.equal(response.status, 200)
      const data = (await response.json()).data
      return { user: data.user, csrfToken: data.csrfToken, cookie: response.headers.getSetCookie().map(c => c.split(';')[0]).join('; ') }
    }
    try {
      const referrer = await registration.register({ name: 'Account regression inviter', email: 'account-inviter-' + tag + '@example.test', password })
      const referrerLogin = await login(referrer.email, password)
      for (const role of ['CUSTOMER', 'ORGANIZER'] as const) {
        stage = role + ': signup/referral/duplicate and role boundaries'
        const email = 'account-' + role.toLowerCase() + '-' + tag + '@example.test'
        const input = { name: 'Account regression ' + role, email, password, role, referralCode: referrer.referralCode }
        const registered = await request('auth/register', 'POST', input); assert.equal(registered.status, 201)
        const user = (await registered.json()).data.user
        assert.equal((await request('auth/register', 'POST', input)).status, 409)
        const first = await login(email, password), second = await login(email, password)
        const headers = { cookie: first.cookie, 'x-csrf-token': first.csrfToken }
        assert.equal((await request('me')).status, 401)
        assert.equal((await request('me/rewards', 'GET', undefined, headers)).status, role === 'CUSTOMER' ? 200 : 403)
        assert.equal((await request('organizer/events', 'GET', undefined, headers)).status, role === 'ORGANIZER' ? 200 : 403)
        const referral = await request('me/referral', 'GET', undefined, headers); assert.equal(referral.status, 200)
        assert.equal((await referral.json()).data.code, user.referralCode)
        assert.equal(await tx.rewardCoupon.count({ where: { userId: user.id } }), 1)
        if (role === 'CUSTOMER') {
          const wallet = (await (await request('me/rewards', 'GET', undefined, headers)).json()).data
          assert.equal(wallet.availableCouponCount, 1); assert.equal(wallet.availablePoints, 0)
        }
        const original = await tx.user.findUniqueOrThrow({ where: { id: user.id } })
        stage = role + ': own-name/photo edits, preservation after errors and public/private visibility'
        assert.equal((await request('me', 'PATCH', { name: 'Spoofed', userId: referrer.id }, headers)).status, 400)
        assert.equal((await request('me', 'PATCH', { name: 'No CSRF' }, { cookie: first.cookie })).status, 403)
        const name = 'Saved profile ' + role
        assert.equal((await request('me?userId=' + referrer.id, 'PATCH', { name }, { ...headers, 'x-user-id': referrer.id })).status, 200)
        const png = await sharp({ create: { width: 700, height: 450, channels: 3, background: '#5748da' } }).png().toBuffer()
        const upload = (bytes: Buffer, more = headers) => fetch(base + '/api/me/picture', { method: 'POST',
          headers: { 'x-temuevent-client': 'web', ...more, 'content-type': 'image/png' }, body: new Uint8Array(bytes) })
        assert.equal((await upload(png, { cookie: first.cookie } as typeof headers)).status, 403)
        assert.equal((await upload(png)).status, 200)
        const key = (await tx.user.findUniqueOrThrow({ where: { id: user.id } })).profilePictureKey!
        assert.equal((await upload(Buffer.from('not an image'))).status, 400)
        assert.equal((await tx.user.findUniqueOrThrow({ where: { id: user.id } })).profilePictureKey, key)
        assert.equal((await upload(png)).status, 200); assert.equal(files.has(key), false)
        const mine = (await (await request('me', 'GET', undefined, headers)).json()).data
        assert.equal(mine.name, name); assert.equal(mine.email, email); assert.equal(mine.referralCode, user.referralCode)
        const privateImage = await request('me/picture', 'GET', undefined, headers); assert.equal(privateImage.status, 200)
        assert.match(privateImage.headers.get('content-type')!, /image\/webp/)
        const image = await sharp(Buffer.from(await privateImage.arrayBuffer())).metadata(); assert.equal(image.width, 512); assert.equal(image.format, 'webp')
        const publicProfile = await request('organizers/' + user.id)
        assert.equal(publicProfile.status, role === 'ORGANIZER' ? 200 : 404)
        if (role === 'ORGANIZER') { const safe = (await publicProfile.json()).data; assert.equal(safe.name, name); assert.equal('email' in safe, false); assert.equal('referralCode' in safe, false) }
        assert.equal((await tx.user.findUniqueOrThrow({ where: { id: referrer.id } })).name, referrer.name)
        stage = role + ': known-password change, two-device rejection, saved profile/rewards survive'
        const changedPassword = ' ' + randomBytes(20).toString('hex') + ' 🐢 '
        assert.equal((await request('auth/password', 'POST', { currentPassword: 'wrong', newPassword: changedPassword }, headers)).status, 400)
        assert.equal((await tx.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash, original.passwordHash)
        assert.equal((await request('auth/password', 'POST', { currentPassword: password, newPassword: changedPassword }, headers)).status, 200)
        for (const prior of [first, second]) assert.equal((await request('me', 'GET', undefined, { cookie: prior.cookie })).status, 401)
        assert.equal((await request('auth/login', 'POST', { email, password })).status, 401)
        const changed = await login(email, changedPassword); assert.equal(changed.user.name, name); assert(changed.user.profilePictureUrl)
        assert.equal(await tx.rewardCoupon.count({ where: { userId: user.id } }), 1)
        stage = role + ': non-enumerating recovery, invalid proof, one-use reset and exact new login'
        const mailBefore = mail.length
        const known = await request('auth/forgot-password', 'POST', { email }), unknown = await request('auth/forgot-password', 'POST', { email: 'unknown-' + role.toLowerCase() + '-' + tag + '@example.test' })
        assert.equal(known.status, 202); assert.equal(unknown.status, 202); assert.deepEqual(await known.json(), await unknown.json())
        await recovery.dispatchPending(); assert.equal(mail.length, mailBefore + 1)
        const token = mail.at(-1)!.text.match(/#token=([A-Za-z0-9_-]{43})/)![1], recoveredPassword = ' 回復 ' + randomBytes(20).toString('hex') + ' '
        assert.equal((await request('auth/reset-password', 'POST', { token: randomBytes(32).toString('base64url'), newPassword: recoveredPassword })).status, 400)
        assert.equal((await request('auth/reset-password', 'POST', { token, newPassword: 'short' })).status, 400)
        assert.equal((await request('auth/reset-password', 'POST', { token, newPassword: recoveredPassword })).status, 200)
        assert.equal((await request('auth/reset-password', 'POST', { token, newPassword: recoveredPassword })).status, 400)
        assert.equal((await request('me', 'GET', undefined, { cookie: changed.cookie })).status, 401)
        assert.equal((await request('auth/login', 'POST', { email, password: changedPassword })).status, 401)
        const recovered = await login(email, recoveredPassword); assert.equal(recovered.user.name, name)
        assert.equal(recovered.user.role, role); assert.equal(recovered.user.referralCode, user.referralCode)
        const fresh = await tx.user.findUniqueOrThrow({ where: { id: user.id } })
        assert.equal(fresh.email, original.email); assert.equal(fresh.role, original.role); assert.equal(fresh.referralCode, original.referralCode)
        stage = role + ': logout, private photo denial and unrelated account stays active'
        assert.equal((await request('auth/logout', 'POST', {}, { cookie: recovered.cookie, 'x-csrf-token': recovered.csrfToken })).status, 200)
        assert.equal((await request('me/picture', 'GET', undefined, { cookie: recovered.cookie })).status, 401)
        assert.equal((await request('organizers/' + user.id + '/picture')).status, role === 'ORGANIZER' ? 200 : 404)
        assert.equal((await request('me', 'GET', undefined, { cookie: referrerLogin.cookie })).status, 200)
      }
      assert.equal(await tx.referral.count({ where: { referrerId: referrer.id } }), 2)
      assert.equal((await tx.pointGrant.aggregate({ where: { userId: referrer.id }, _sum: { remainingAmount: true } }))._sum.remainingAmount, 20000n)
    } finally { await recovery.dispatchPending(); await new Promise<void>(resolve => server.close(() => resolve())); files.clear() }
    throw rollback
  }, { timeout: 240000 }).catch(error => { if (error !== rollback) throw error })
  stage = 'rollback preserves the complete baseline'
  assert.deepEqual(await snapshot(), before)
  console.log('ACCOUNT_REGRESSION_DB_OK: both roles through referral signup/duplicate denial, wallet/role/CSRF/owner boundaries, image normalization/replacement/error preservation/private-public reads, password change, generic recovery/single-use reset, exact new login/logout and other-account isolation; all SQL writes rolled back, original user fingerprints/counts unchanged. File/mail transports explicitly simulated.')
}
main().catch(error => { console.error('Account regression failed at: ' + stage); console.error(JSON.stringify({ name: error?.name, code: error?.code, location: error?.stack?.match(/verify-account-regression\.ts:\d+:\d+/)?.[0],
  operator: error?.operator, expectedType: typeof error?.expected, actualType: typeof error?.actual,
  expected: error?.name === 'AssertionError' && ['number', 'boolean'].includes(typeof error?.expected) ? error.expected : undefined,
  actual: error?.name === 'AssertionError' && ['number', 'boolean'].includes(typeof error?.actual) ? error.actual : undefined,
  model: error?.meta?.modelName, driverCode: error?.meta?.driverAdapterError?.cause?.originalCode })); process.exitCode = 1 }).finally(disconnectDatabase)
