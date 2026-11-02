import assert from 'node:assert/strict'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import sharp from 'sharp'
import { createApp } from '../server/app'
import { normalizePicture } from '../server/profile/pictures'
import { createProfileService, ownedPictureKey, type PictureStorage, type ProfileRepository } from '../server/profile/service'
import type { ProfileRecord } from '../server/profile/views'
import { sessionFixture, loginFields, testAccount } from './helpers/sessions'

const otherId = '22222222-2222-4222-8222-222222222222'
const key = (id = testAccount.id) => 'profiles/' + id + '/' + randomUUID() + '.webp'
function fixture() {
  const f = sessionFixture()
  const records = new Map<string, ProfileRecord>([
    [testAccount.id, { id: testAccount.id, name: 'Original Customer', email: testAccount.email, role: 'CUSTOMER',
      referralCode: testAccount.referralCode, profilePictureKey: null }],
    [otherId, { id: otherId, name: 'Public Organizer', email: 'private@example.test', role: 'ORGANIZER',
      referralCode: 'PRIVATECODE', profilePictureKey: null }],
  ])
  const files = new Map<string, Buffer>(), removed: string[] = []
  const repository: ProfileRepository = {
    async find(id) { return records.get(id) ?? null },
    async findOrganizer(id) { const user = records.get(id); return user?.role === 'ORGANIZER' ? user : null },
    async updateName(id, name) { const user = records.get(id)!; user.name = name; return { ...user } },
    async replacePicture(id, pictureKey) {
      const user = records.get(id)!, previousKey = user.profilePictureKey
      user.profilePictureKey = pictureKey; return { user: { ...user }, previousKey }
    },
  }
  const storage: PictureStorage = {
    async upload(key, bytes) { files.set(key, bytes) },
    async download(key) { if (!files.has(key)) throw new Error('Missing'); return files.get(key)! },
    async remove(key) { removed.push(key); files.delete(key) },
  }
  let cleanupFailures = 0
  const service = createProfileService({ repository, storage, normalize: async bytes => bytes,
    onCleanupFailure: () => { cleanupFailures++ } })
  return { f, records, files, removed, repository, storage, service, cleanupFailures: () => cleanupFailures }
}
async function http(f: ReturnType<typeof fixture>, work: (base: string, headers: Record<string, string>) => Promise<void>) {
  const credentials = await f.f.service.login(loginFields)
  const server = createApp({ sessionService: f.f.service, profileService: f.service, now: f.f.now }).listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing port')
  try { await work('http://127.0.0.1:' + address.port, {
    cookie: 'temuevent_access=' + credentials.accessToken + '; temuevent_refresh=' + credentials.refreshToken,
    'x-csrf-token': credentials.csrfToken, 'x-temuevent-client': 'web',
  }) } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
}

test('normalization decodes pixels, resizes and removes image metadata', async () => {
  const png = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#5148df' } }).withMetadata().png().toBuffer()
  const bytes = await normalizePicture(png, 'image/png'), info = await sharp(bytes).metadata()
  assert.equal(info.format, 'webp'); assert.equal(info.width, 512); assert.equal(info.height, 384)
  assert.equal(info.exif, undefined); assert.equal(info.xmp, undefined)
})
test('invalid, disguised, mismatched and over-dimension files never become profile images', async () => {
  for (const bytes of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'), Buffer.from('not an image')]) {
    await assert.rejects(normalizePicture(bytes, 'image/png'), { code: 'INVALID_PICTURE' })
  }
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#fff' } }).png().toBuffer()
  await assert.rejects(normalizePicture(png, 'image/jpeg'), { code: 'INVALID_PICTURE' })
  const large = await sharp({ create: { width: 4001, height: 4000, channels: 3, background: '#fff' } }).png().toBuffer()
  await assert.rejects(normalizePicture(large, 'image/png'), { code: 'INVALID_PICTURE' })
})
test('profile writes require real authentication and session-bound CSRF before parsing', async () => {
  const f = fixture()
  await http(f, async (base, headers) => {
    const patch = (values: Record<string, string>) => fetch(base + '/api/me', {
      method: 'PATCH', headers: { 'content-type': 'application/json', ...values }, body: JSON.stringify({ name: 'New Name' }),
    })
    assert.equal((await patch({ 'x-demo-persona': 'organizer' })).status, 401)
    assert.equal((await patch({ ...headers, 'x-csrf-token': 'wrong' })).status, 403)
    assert.equal((await patch({ ...headers, 'sec-fetch-site': 'cross-site' })).status, 403)
    assert.equal((await fetch(base + '/api/me/picture', { method: 'POST', body: 'large invalid payload' })).status, 401)
    assert.equal(f.records.get(testAccount.id)!.name, 'Original Customer')
  })
})
test('only the current name is editable; caller-supplied identity and immutable fields are rejected', async () => {
  const f = fixture()
  await http(f, async (base, headers) => {
    const patch = (body: unknown) => fetch(base + '/api/me', {
      method: 'PATCH', headers: { ...headers, 'content-type': 'application/json', 'x-user-id': otherId }, body: JSON.stringify(body),
    })
    for (const field of ['id', 'userId', 'email', 'role', 'referralCode', 'profilePictureKey', 'profilePictureUrl']) {
      assert.equal((await patch({ name: 'New Name', [field]: 'forged' })).status, 400)
    }
    assert.equal((await patch({ name: ' ' })).status, 400)
    const saved = await patch({ name: '  Nama Baru  ' })
    assert.equal(saved.status, 200); assert.equal((await saved.json()).data.name, 'Nama Baru')
    assert.equal(f.records.get(otherId)!.name, 'Public Organizer')
    assert.equal(f.records.get(testAccount.id)!.email, testAccount.email)
    // Both roles use the same own-profile route.
    f.f.users.get(testAccount.email)!.role = 'ORGANIZER'
    assert.equal((await patch({ name: 'Organizer Name' })).status, 200)
  })
})
test('photo uploads derive their owner, replace once and keep customer pictures private', async () => {
  const f = fixture(), oldKey = key()
  f.records.get(testAccount.id)!.profilePictureKey = oldKey; f.files.set(oldKey, Buffer.from('old image'))
  await http(f, async (base, headers) => {
    const upload = await fetch(base + '/api/me/picture', { method: 'POST', headers: {
      ...headers, 'content-type': 'image/png', 'x-user-id': otherId }, body: Buffer.from('normalized test image') })
    assert.equal(upload.status, 200)
    const result = await upload.json(), newKey = f.records.get(testAccount.id)!.profilePictureKey!
    assert(ownedPictureKey(testAccount.id, newKey)); assert.equal(f.files.has(oldKey), false)
    assert.equal(f.files.has(newKey), true); assert.equal(f.records.get(otherId)!.profilePictureKey, null)
    assert.equal(JSON.stringify(result).includes('profiles/'), false)
    assert.match(result.data.profilePictureUrl, /^\/api\/me\/picture\?v=/)
    assert.equal((await fetch(base + result.data.profilePictureUrl)).status, 401)
    const image = await fetch(base + result.data.profilePictureUrl, { headers })
    assert.equal(image.status, 200); assert.match(image.headers.get('content-type')!, /image\/webp/)
    assert.equal(image.headers.get('cache-control'), 'no-store')
    assert.equal(image.headers.get('x-content-type-options'), 'nosniff')
    assert.equal((await fetch(base + '/api/organizers/' + testAccount.id + '/picture')).status, 404)
  })
})
test('public organizer projection omits account details and never treats a customer as an organizer', async () => {
  const f = fixture(), organizerKey = key(otherId)
  f.records.get(otherId)!.profilePictureKey = organizerKey; f.files.set(organizerKey, Buffer.from('public image'))
  await http(f, async base => {
    const response = await fetch(base + '/api/organizers/' + otherId), body = await response.json()
    assert.equal(response.status, 200)
    assert.deepEqual(Object.keys(body.data).sort(), ['bio', 'id', 'name', 'profilePictureUrl', 'ratingSummary'])
    assert.equal(body.data.ratingSummary, null)
    assert.equal(JSON.stringify(body).includes('private@example.test'), false)
    assert.equal(JSON.stringify(body).includes('PRIVATECODE'), false)
    assert.equal((await fetch(base + body.data.profilePictureUrl)).status, 200)
    assert.equal((await fetch(base + '/api/organizers/' + testAccount.id)).status, 404)
    assert.equal((await fetch(base + '/api/organizers/not-a-uuid')).status, 400)
  })
})
test('upload type, byte-size and compressed-body boundaries fail without changing the profile', async () => {
  const f = fixture()
  await http(f, async (base, headers) => {
    const post = (type: string, bytes: Buffer, extra = {}) => fetch(base + '/api/me/picture', {
      method: 'POST', headers: { ...headers, 'content-type': type, ...extra }, body: new Uint8Array(bytes),
    })
    assert.equal((await post('image/svg+xml', Buffer.from('<svg/>'))).status, 415)
    assert.equal((await post('image/png', Buffer.alloc(5 * 1024 * 1024 + 1))).status, 413)
    assert.equal((await post('image/png', Buffer.from('not gzip'), { 'content-encoding': 'gzip' })).status, 415)
    assert.equal((await post('image/png', Buffer.alloc(0))).status, 400)
    assert.equal(f.files.size, 0); assert.equal(f.records.get(testAccount.id)!.profilePictureKey, null)
  })
})
test('missing storage leaves name editing available and reports photo configuration honestly', async () => {
  const f = fixture()
  const service = createProfileService({ repository: f.repository, normalize: normalizePicture })
  assert.equal((await service.updateName(testAccount.id, { name: 'Available Name' })).name, 'Available Name')
  await assert.rejects(service.upload(testAccount.id, Buffer.from('image'), 'image/png'), { code: 'PICTURE_NOT_CONFIGURED' })
  assert.equal(f.records.get(testAccount.id)!.profilePictureKey, null)
})
test('failed storage or database writes preserve the current photo and clean candidate files', async () => {
  const f = fixture(), oldKey = key()
  f.records.get(testAccount.id)!.profilePictureKey = oldKey; f.files.set(oldKey, Buffer.from('old'))
  f.repository.replacePicture = async () => { throw new Error('Database unavailable') }
  await assert.rejects(f.service.upload(testAccount.id, Buffer.from('new'), 'image/png'))
  assert.deepEqual([...f.files.keys()], [oldKey])
  f.storage.upload = async (key, bytes) => { f.files.set(key, bytes); throw new Error('Lost upload response') }
  await assert.rejects(f.service.upload(testAccount.id, Buffer.from('new'), 'image/png'), { code: 'PICTURE_UNAVAILABLE' })
  assert.deepEqual([...f.files.keys()], [oldKey])
})
test('a lost database success response does not delete the committed photo', async () => {
  const f = fixture()
  const swap = f.repository.replacePicture
  f.repository.replacePicture = async (...args) => { await swap(...args); throw new Error('Lost commit reply') }
  const updated = await f.service.upload(testAccount.id, Buffer.from('new'), 'image/png')
  assert(updated.profilePictureUrl)
  assert.equal(f.files.has(f.records.get(testAccount.id)!.profilePictureKey!), true)
  assert.equal(f.removed.length, 0)
})
test('cleanup never deletes another owner\'s file and cleanup errors do not undo a committed edit', async () => {
  const f = fixture(), foreign = key(otherId)
  f.records.get(testAccount.id)!.profilePictureKey = foreign; f.files.set(foreign, Buffer.from('other'))
  await f.service.upload(testAccount.id, Buffer.from('own'), 'image/png')
  assert.equal(f.files.has(foreign), true)
  f.storage.remove = async () => { throw new Error('Cleanup unavailable') }
  const saved = await f.service.upload(testAccount.id, Buffer.from('replacement'), 'image/png')
  assert(saved.profilePictureUrl); assert.equal(f.cleanupFailures(), 1)
})
