import assert from 'node:assert/strict'
import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { once } from 'node:events'
import sharp from 'sharp'
import { createApp } from '../server/app'
import { databaseClient, disconnectDatabase } from '../server/database'
import { createRegistrationService } from '../server/auth/registration'
import { prismaRegistrationRepository } from '../server/auth/registration-repository'
import { createSessionService } from '../server/auth/sessions'
import { prismaSessionRepository } from '../server/auth/session-repository'
import { createSessionTokens } from '../server/auth/session-tokens'
import { prismaProfileRepository } from '../server/profile/repository'
import { createProfileService, type PictureStorage } from '../server/profile/service'
import { normalizePicture } from '../server/profile/pictures'
import { registrationSavepoints } from './helpers/registration-transaction'

const db = databaseClient(), rollback = new Error('ROLLBACK_PROFILE_CHECK'), tag = randomUUID()
const emails = ['customer-' + tag + '@example.test', 'organizer-' + tag + '@example.test']
let stage = 'baseline'
async function main() {
  const fingerprint = async () => createHash('sha256').update(JSON.stringify(await db.user.findMany({ orderBy: { id: 'asc' } }))).digest('hex')
  const before = await fingerprint()
  await assert.rejects(db.$transaction(async tx => {
    const password = randomBytes(24).toString('base64url')
    const registration = createRegistrationService({ repository: prismaRegistrationRepository(tx, registrationSavepoints(tx)) })
    const sessions = createSessionService({ repository: prismaSessionRepository(tx, work => work(tx)),
      tokens: createSessionTokens(randomBytes(32).toString('hex')) })
    const files = new Map<string, Buffer>()
    // Test transport only: this checks real SQL ownership/persistence, not the hosted Storage service.
    const storage: PictureStorage = {
      async upload(key, bytes) { files.set(key, bytes) },
      async download(key) { assert(files.has(key)); return files.get(key)! },
      async remove(key) { files.delete(key) },
    }
    const profileService = createProfileService({ repository: prismaProfileRepository(tx, work => work(tx)), storage, normalize: normalizePicture })
    const server = createApp({ registrationService: registration, sessionService: sessions, profileService })
      .listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('No port')
    const base = 'http://127.0.0.1:' + address.port
    const png = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#5148df' } }).png().toBuffer()
    try {
      stage = 'real signup/login, own edits and picture metadata'
      for (let index = 0; index < 2; index++) {
        const role = index === 0 ? 'CUSTOMER' : 'ORGANIZER'
        const user = await registration.register({ name: 'Profile QA', email: emails[index], password, role })
        const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: {
          'content-type': 'application/json', 'x-temuevent-client': 'web' }, body: JSON.stringify({ email: user.email, password }) })
        assert.equal(login.status, 200)
        const credentials = (await login.json()).data
        const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
        const headers = { cookie, 'x-temuevent-client': 'web', 'x-csrf-token': credentials.csrfToken }
        const updated = await fetch(base + '/api/me', { method: 'PATCH', headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Updated ' + role }) })
        assert.equal(updated.status, 200)
        assert.equal((await (await fetch(base + '/api/me', { headers: { cookie } })).json()).data.name, 'Updated ' + role)
        const uploaded = await fetch(base + '/api/me/picture', { method: 'POST', headers: { ...headers, 'content-type': 'image/png' }, body: png })
        assert.equal(uploaded.status, 200)
        const safe = (await uploaded.json()).data
        const persisted = await tx.user.findUniqueOrThrow({ where: { id: user.id } })
        assert(persisted.profilePictureKey?.startsWith('profiles/' + user.id + '/'))
        assert.equal(persisted.email, user.email); assert.equal(persisted.referralCode, user.referralCode); assert.equal(persisted.role, role)
        const me = await fetch(base + '/api/me', { headers: { cookie } })
        assert.equal((await me.json()).data.profilePictureUrl, safe.profilePictureUrl)
        const image = await fetch(base + safe.profilePictureUrl, { headers: { cookie } })
        assert.equal(image.status, 200)
        const meta = await sharp(Buffer.from(await image.arrayBuffer())).metadata()
        assert.equal(meta.format, 'webp'); assert.equal(meta.width, 512)
        const publicResponse = await fetch(base + '/api/organizers/' + user.id)
        assert.equal(publicResponse.status, role === 'ORGANIZER' ? 200 : 404)
        if (role === 'ORGANIZER') {
          const publicProfile = (await publicResponse.json()).data
          assert.equal(publicProfile.name, 'Updated ORGANIZER')
          assert.equal(publicProfile.email, undefined); assert.equal(publicProfile.referralCode, undefined)
          assert.equal((await fetch(base + publicProfile.profilePictureUrl)).status, 200)
        }
        // Replacement uses a new immutable key and removes the superseded file.
        assert.equal((await fetch(base + '/api/me/picture', { method: 'POST', headers: { ...headers, 'content-type': 'image/png' }, body: png })).status, 200)
        assert.equal(files.has(persisted.profilePictureKey!), false)
        await sessions.logout(cookie.split('temuevent_refresh=')[1])
        assert.equal((await fetch(base + safe.profilePictureUrl, { headers: { cookie } })).status, 401)
      }
    } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
    throw rollback
  }, { timeout: 120000 }), error => error === rollback)
  stage = 'rollback and original user fingerprints'
  assert.equal(await db.user.count({ where: { email: { in: emails } } }), 0)
  assert.equal(await fingerprint(), before)
  console.log('PROFILE_DB_OK: real signup/login, both-role name edits, persisted photo keys, current-session identity, private customer/public organizer reads, replacements and logout; all SQL fixtures rolled back. Image transport was simulated; hosted Storage remains unverified.')
}
main().catch(error => {
  const cause = error?.actual ?? error
  console.error('Profile verification failed at: ' + stage)
  console.error(JSON.stringify({ name: cause?.name, code: cause?.code, model: cause?.meta?.modelName,
    driverCode: cause?.meta?.driverAdapterError?.cause?.originalCode }))
  process.exitCode = 1
}).finally(disconnectDatabase)
