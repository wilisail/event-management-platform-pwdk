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
import { supabaseProfileStorage } from '../server/profile/storage'
import { MAX_STORED_PICTURE_BYTES } from '../server/profile/service'
import { registrationSavepoints } from './helpers/registration-transaction'

const db = databaseClient(), rollback = new Error('ROLLBACK_PROFILE_CHECK'), tag = randomUUID()
const emails = ['customer-' + tag + '@example.test', 'organizer-' + tag + '@example.test']
const hosted = process.argv.includes('--hosted-storage')
const remote = hosted ? supabaseProfileStorage() : undefined
const createdKeys = new Set<string>()
let stage = 'baseline'
async function assertRemoved(key: string) {
  const result = await remote!.client.storage.from(remote!.bucket).download(key)
  assert(result.error && !result.data, 'Superseded/test object must be absent')
  assert(['400', '404'].includes(String(result.error.status)), 'Absence must not be an authorization/provider error')
}
async function main() {
  if (hosted) {
    assert(remote, 'Hosted verification requires private storage settings')
    stage = 'private bucket configuration'
    const bucket = await remote.client.storage.getBucket(remote.bucket)
    assert(!bucket.error && bucket.data)
    assert.equal(bucket.data.public, false)
    assert.equal(Number(bucket.data.file_size_limit), MAX_STORED_PICTURE_BYTES)
    assert.deepEqual(bucket.data.allowed_mime_types, ['image/webp'])
  }
  const fingerprint = async () => createHash('sha256').update(JSON.stringify(await db.user.findMany({ orderBy: { id: 'asc' } }))).digest('hex')
  const before = await fingerprint()
  await assert.rejects(db.$transaction(async tx => {
    const password = randomBytes(24).toString('base64url')
    const registration = createRegistrationService({ repository: prismaRegistrationRepository(tx, registrationSavepoints(tx)) })
    const sessions = createSessionService({ repository: prismaSessionRepository(tx, work => work(tx)),
      tokens: createSessionTokens(randomBytes(32).toString('hex')) })
    const files = new Map<string, Buffer>()
    // Default transport is simulated. Hosted mode uses the exact backend adapter.
    const storage: PictureStorage = remote ? {
      async upload(key, bytes) { createdKeys.add(key); await remote.storage.upload(key, bytes) },
      download: key => remote.storage.download(key),
      remove: key => remote.storage.remove(key),
    } : {
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
        assert.equal((await fetch(base + '/api/me/picture', { method: 'POST', headers: { 'content-type': 'image/png' }, body: png })).status, 401)
        assert.equal((await fetch(base + '/api/me/picture', { method: 'POST', headers: { cookie, 'x-temuevent-client': 'web', 'content-type': 'image/png' }, body: png })).status, 403)
        assert.equal((await fetch(base + '/api/me', { method: 'PATCH', headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Spoofed', userId: randomUUID() }) })).status, 400)
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
        assert.equal(meta.exif, undefined)
        assert.equal((await fetch(base + safe.profilePictureUrl)).status, 401)
        if (remote) {
          const direct = await fetch(new URL('/storage/v1/object/public/' + remote.bucket + '/' + persisted.profilePictureKey,
            process.env.SUPABASE_URL), { signal: AbortSignal.timeout(10000) })
          assert.equal(direct.ok, false, 'Private bucket must refuse anonymous object URLs')
          await direct.arrayBuffer()
        }
        // A disguised file cannot replace the saved image or its database key.
        assert.equal((await fetch(base + '/api/me/picture', { method: 'POST', headers: { ...headers, 'content-type': 'image/png' },
          body: Buffer.from('not an image') })).status, 400)
        assert.equal((await tx.user.findUniqueOrThrow({ where: { id: user.id } })).profilePictureKey, persisted.profilePictureKey)
        const publicResponse = await fetch(base + '/api/organizers/' + user.id)
        assert.equal(publicResponse.status, role === 'ORGANIZER' ? 200 : 404)
        if (role === 'ORGANIZER') {
          const publicProfile = (await publicResponse.json()).data
          assert.equal(publicProfile.name, 'Updated ORGANIZER')
          assert.equal(publicProfile.email, undefined); assert.equal(publicProfile.referralCode, undefined)
          assert.equal((await fetch(base + publicProfile.profilePictureUrl)).status, 200)
        } else {
          assert.equal((await fetch(base + '/api/organizers/' + user.id + '/picture')).status, 404)
        }
        // Replacement uses a new immutable key and removes the superseded file.
        assert.equal((await fetch(base + '/api/me/picture', { method: 'POST', headers: { ...headers, 'content-type': 'image/png' }, body: png })).status, 200)
        const replaced = await tx.user.findUniqueOrThrow({ where: { id: user.id } })
        assert.notEqual(replaced.profilePictureKey, persisted.profilePictureKey)
        if (remote) await assertRemoved(persisted.profilePictureKey!)
        else assert.equal(files.has(persisted.profilePictureKey!), false)
        assert.equal((await fetch(base + safe.profilePictureUrl, { headers: { cookie } })).status, 200)
        await sessions.logout(cookie.split('temuevent_refresh=')[1])
        assert.equal((await fetch(base + safe.profilePictureUrl, { headers: { cookie } })).status, 401)
      }
    } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
    throw rollback
  }, { timeout: hosted ? 240000 : 120000 }), error => error === rollback)
  stage = 'rollback and original user fingerprints'
  assert.equal(await db.user.count({ where: { email: { in: emails } } }), 0)
  assert.equal(await fingerprint(), before)
  if (remote) {
    stage = 'hosted object cleanup'
    for (const key of createdKeys) { await remote.storage.remove(key); await assertRemoved(key) }
    createdKeys.clear()
    console.log('PROFILE_STORAGE_OK: real Supabase uploads/downloads/replacements, private bucket, normalized WebP, ownership/CSRF, rejected invalid files, customer/organizer visibility and logout; SQL fixtures rolled back and all test objects removed.')
  } else {
    console.log('PROFILE_DB_OK: real signup/login, both-role name edits, persisted photo keys, current-session identity, private customer/public organizer reads, replacements and logout; all SQL fixtures rolled back. Image transport was simulated; hosted Storage remains unverified.')
  }
}
main().catch(error => {
  const cause = error?.actual ?? error
  console.error('Profile verification failed at: ' + stage)
  console.error(JSON.stringify({ name: cause?.name, code: cause?.code, model: cause?.meta?.modelName,
    driverCode: cause?.meta?.driverAdapterError?.cause?.originalCode }))
  process.exitCode = 1
}).finally(async () => {
  // Storage is outside the rollback. Clean only this run's random object keys, even on failure.
  if (remote && createdKeys.size) {
    try { for (const key of createdKeys) { await remote.storage.remove(key); await assertRemoved(key) } }
    catch { console.error('Profile verification object cleanup needs attention'); process.exitCode = 1 }
  }
  await disconnectDatabase()
})
