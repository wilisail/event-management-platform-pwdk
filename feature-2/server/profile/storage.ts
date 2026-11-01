import { createClient } from '@supabase/supabase-js'
import { MAX_STORED_PICTURE_BYTES, type PictureStorage } from './service'

/** Backend only. Application cookies are not Supabase Auth credentials. */
export function supabaseProfileStorage(env: Record<string, string | undefined> = process.env, transport: typeof fetch = fetch) {
  const projectUrl = env.SUPABASE_URL, secret = env.SUPABASE_SECRET_KEY
  if (!projectUrl && !secret) return undefined
  if (!projectUrl || !secret) throw new Error('Both backend storage settings are required')
  const url = new URL(projectUrl)
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Use the HTTPS Supabase project origin')
  }
  const bucket = env.F2_PROFILE_BUCKET || 'profile-pictures'
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(bucket)) throw new Error('Invalid profile bucket name')
  const client = createClient(url.origin, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => transport(input, { ...init,
      signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000) }) },
  })
  const files = client.storage.from(bucket)
  const storage: PictureStorage = {
    async upload(key, bytes) {
      const result = await files.upload(key, bytes, { contentType: 'image/webp', upsert: false, cacheControl: '0' })
      if (result.error) throw new Error('Storage upload failed')
    },
    async download(key) {
      const result = await files.download(key)
      if (result.error || !result.data || result.data.size > MAX_STORED_PICTURE_BYTES) throw new Error('Storage download failed')
      return Buffer.from(await result.data.arrayBuffer())
    },
    async remove(key) {
      const result = await files.remove([key])
      if (result.error) throw new Error('Storage cleanup failed')
    },
  }
  return { client, bucket, storage }
}
