import 'dotenv/config'
import { supabaseProfileStorage } from '../server/profile/storage'
import { MAX_STORED_PICTURE_BYTES } from '../server/profile/service'

async function main() {
  const config = supabaseProfileStorage()
  if (!config) throw new Error('Missing private storage configuration')
  const existing = await config.client.storage.getBucket(config.bucket)
  if (existing.error && String(existing.error.status) !== '404') throw new Error('Cannot inspect storage')
  if (!existing.data) {
    const created = await config.client.storage.createBucket(config.bucket, {
      public: false, fileSizeLimit: MAX_STORED_PICTURE_BYTES, allowedMimeTypes: ['image/webp'],
    })
    if (created.error) throw new Error('Cannot create private profile bucket')
  }
  const verified = await config.client.storage.getBucket(config.bucket)
  if (verified.error || !verified.data || verified.data.public ||
    Number(verified.data.file_size_limit) !== MAX_STORED_PICTURE_BYTES ||
    verified.data.allowed_mime_types?.length !== 1 || verified.data.allowed_mime_types[0] !== 'image/webp') {
    throw new Error('Bucket configuration differs; review it before proceeding')
  }
  console.log('PROFILE_BUCKET_READY: private; WebP only; 1 MiB normalized limit; backend uploads')
}
main().catch(() => {
  console.error('Profile storage setup failed. Check the private backend settings and bucket configuration.')
  process.exitCode = 1
})
