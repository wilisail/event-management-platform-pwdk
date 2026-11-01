import { MAX_STORED_PICTURE_BYTES } from './service'
import type { supabaseProfileStorage } from './storage'

export class ProfileBucketSetupError extends Error {
  constructor(readonly stage: string, readonly httpStatus?: number) { super('Private profile bucket setup failed') }
}

export async function ensurePrivateProfileBucket(config: NonNullable<ReturnType<typeof supabaseProfileStorage>>) {
  const existing = await config.client.storage.getBucket(config.bucket)
  // The legacy Storage response uses HTTP 400 for this specific missing-bucket error.
  const missing = existing.error && (String(existing.error.status) === '404' ||
    (String(existing.error.status) === '400' && existing.error.message === 'Bucket not found'))
  if (existing.error && !missing) throw new ProfileBucketSetupError('inspect bucket', Number(existing.error.status))
  if (!existing.data) {
    const created = await config.client.storage.createBucket(config.bucket, {
      public: false, fileSizeLimit: MAX_STORED_PICTURE_BYTES, allowedMimeTypes: ['image/webp'],
    })
    if (created.error) throw new ProfileBucketSetupError('create bucket', Number(created.error.status))
  }
  const verified = await config.client.storage.getBucket(config.bucket)
  if (verified.error || !verified.data || verified.data.public ||
    Number(verified.data.file_size_limit) !== MAX_STORED_PICTURE_BYTES ||
    verified.data.allowed_mime_types?.length !== 1 || verified.data.allowed_mime_types[0] !== 'image/webp') {
    throw new ProfileBucketSetupError('verify bucket', verified.error ? Number(verified.error.status) : undefined)
  }
}
