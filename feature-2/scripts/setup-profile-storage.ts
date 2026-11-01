import 'dotenv/config'
import { supabaseProfileStorage } from '../server/profile/storage'
import { ensurePrivateProfileBucket, ProfileBucketSetupError } from '../server/profile/bucket'

async function main() {
  const config = supabaseProfileStorage()
  if (!config) throw new Error('Missing private storage configuration')
  await ensurePrivateProfileBucket(config)
  console.log('PROFILE_BUCKET_READY: private; WebP only; 1 MiB normalized limit; backend uploads')
}
main().catch(error => {
  console.error('Profile storage setup failed. Check the private backend settings and bucket configuration.')
  console.error(JSON.stringify(error instanceof ProfileBucketSetupError
    ? { stage: error.stage, ...(Number.isFinite(error.httpStatus) ? { httpStatus: error.httpStatus } : {}) }
    : { stage: 'configuration' }))
  process.exitCode = 1
})
