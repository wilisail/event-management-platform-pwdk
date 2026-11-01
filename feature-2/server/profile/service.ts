import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { OrganizerView } from '../../contracts/types'
import { pictureUrl, profileUser, type ProfileRecord } from './views'

export const MAX_PICTURE_BYTES = 5 * 1024 * 1024
export const MAX_STORED_PICTURE_BYTES = 1024 * 1024
export const PICTURE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export class ProfileError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message) }
}

export interface ProfileRepository {
  find(userId: string): Promise<ProfileRecord | null>
  findOrganizer(organizerId: string): Promise<ProfileRecord | null>
  updateName(userId: string, name: string): Promise<ProfileRecord>
  /** Serialize picture swaps on the user row; return the previous key for post-commit cleanup. */
  replacePicture(userId: string, key: string): Promise<{ user: ProfileRecord; previousKey: string | null }>
}
export interface PictureStorage {
  upload(key: string, bytes: Buffer): Promise<void>
  download(key: string): Promise<Buffer>
  remove(key: string): Promise<void>
}
export type PictureNormalizer = (bytes: Buffer, contentType: string) => Promise<Buffer>

const nameInput = z.strictObject({ name: z.string().trim().min(2).max(100)
  .refine(value => !/[\u0000-\u001f\u007f]/.test(value)) })
const uuid = z.uuid()
const missing = () => new ProfileError(404, 'PROFILE_NOT_FOUND', 'Profile not found')
const unavailable = () => new ProfileError(503, 'PICTURE_UNAVAILABLE', 'Photo storage is temporarily unavailable')

export function ownedPictureKey(userId: string, key: string) {
  return uuid.safeParse(userId).success && key.startsWith('profiles/' + userId + '/') &&
    uuid.safeParse(key.slice(('profiles/' + userId + '/').length, -5)).success && key.endsWith('.webp')
}

export function createProfileService(options: {
  repository: ProfileRepository
  normalize: PictureNormalizer
  storage?: PictureStorage
  onCleanupFailure?: () => void
}) {
  const { repository, storage } = options
  // A failed cleanup must not undo a committed profile update. No secrets enter logs.
  async function cleanup(userId: string, key: string | null) {
    if (!key || !ownedPictureKey(userId, key)) return
    try { await storage!.remove(key) } catch { options.onCleanupFailure?.() }
  }
  async function record(id: string, isPublic: boolean) {
    const user = isPublic ? await repository.findOrganizer(id) : await repository.find(id)
    if (!user) throw missing()
    return user
  }
  return {
    async updateName(userId: string, input: unknown) {
      const parsed = nameInput.safeParse(input)
      if (!parsed.success) throw new ProfileError(400, 'INVALID_PROFILE', 'Use a name of 2–100 characters; no extra fields')
      return profileUser(await repository.updateName(userId, parsed.data.name))
    },
    async publicOrganizer(id: string): Promise<OrganizerView> {
      const user = await record(id, true)
      return { id: user.id, name: user.name, bio: '', profilePictureUrl: pictureUrl(user.profilePictureKey, id),
        ratingSummary: null } // Feature 1 supplies review aggregates; no invented count or rating.
    },
    async picture(userId: string, isPublic = false) {
      const user = await record(userId, isPublic)
      if (!user.profilePictureKey || !ownedPictureKey(userId, user.profilePictureKey)) throw missing()
      if (!storage) throw unavailable()
      try {
        const bytes = await storage.download(user.profilePictureKey)
        if (!bytes.length || bytes.length > MAX_STORED_PICTURE_BYTES) throw unavailable()
        return bytes
      } catch { throw unavailable() }
    },
    async upload(userId: string, bytes: Buffer, contentType: string) {
      if (!storage) throw new ProfileError(503, 'PICTURE_NOT_CONFIGURED', 'Photo uploads are not configured')
      if (!uuid.safeParse(userId).success) throw missing()
      if (!Buffer.isBuffer(bytes) || !bytes.length) throw new ProfileError(400, 'INVALID_PICTURE', 'Choose an image')
      if (bytes.length > MAX_PICTURE_BYTES) throw new ProfileError(413, 'PICTURE_TOO_LARGE', 'Photo limit is 5 MiB')
      if (!PICTURE_TYPES.some(type => type === contentType)) {
        throw new ProfileError(415, 'INVALID_PICTURE_TYPE', 'Use JPEG, PNG or WebP')
      }
      const normalized = await options.normalize(bytes, contentType)
      const key = 'profiles/' + userId + '/' + randomUUID() + '.webp'
      try { await storage.upload(key, normalized) }
      catch { await cleanup(userId, key); throw unavailable() }
      let result: { user: ProfileRecord; previousKey: string | null }
      try { result = await repository.replacePicture(userId, key) }
      catch (error) {
        // A lost database reply could follow a committed swap. Check before deleting its file.
        try {
          const current = await repository.find(userId)
          if (current?.profilePictureKey === key) return profileUser(current)
          await cleanup(userId, key)
        } catch { options.onCleanupFailure?.() }
        throw error
      }
      await cleanup(userId, result.previousKey)
      return profileUser(result.user)
    },
  }
}
export type ProfileService = ReturnType<typeof createProfileService>
