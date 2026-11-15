import { createClient } from '@supabase/supabase-js'
import { MAX_PAYMENT_PROOF_BYTES, type PaymentProofStorage } from './private-proof'

/** Backend credentials and a fixed private bucket; no caller URL is fetched or returned. */
export function supabasePaymentProofStorage(env: Record<string, string | undefined> = process.env, transport: typeof fetch = fetch) {
  const projectUrl = env.SUPABASE_URL, secret = env.SUPABASE_SECRET_KEY
  if (!projectUrl && !secret) return undefined
  if (!projectUrl || !secret) throw new Error('Both backend storage settings are required')
  const url = new URL(projectUrl)
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Use the HTTPS Supabase project origin')
  }
  const bucket = env.F2_PAYMENT_PROOF_BUCKET || 'payment-proofs'
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(bucket) || bucket === (env.F2_PROFILE_BUCKET || 'profile-pictures')) {
    throw new Error('Use a separate private payment-proof bucket')
  }
  const client = createClient(url.origin, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => transport(input, { ...init,
      signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000) }) },
  })
  const checkReadiness = async () => {
    const { data, error } = await client.storage.getBucket(bucket)
    const limit = Number(data?.file_size_limit)
    if (error || !data || data.public || !(limit > 0 && limit <= MAX_PAYMENT_PROOF_BYTES) ||
      !data.allowed_mime_types?.includes('image/jpeg') || data.allowed_mime_types.some(type => !['image/png', 'image/jpeg'].includes(type))) {
      throw new Error('Payment-proof bucket must be private and bounded')
    }
  }
  const storage: PaymentProofStorage = {
    async write(key, file) {
      if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/.test(key)) throw new Error('Invalid new proof key')
      await checkReadiness()
      if (!file.bytes.byteLength || file.bytes.byteLength > MAX_PAYMENT_PROOF_BYTES || file.contentType !== 'image/jpeg') throw new Error('Invalid proof upload')
      const { error } = await client.storage.from(bucket).upload(key, file.bytes, { contentType: 'image/jpeg', upsert: false })
      if (error) throw new Error('Private proof upload failed')
    },
    async remove(key) {
      if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/.test(key)) throw new Error('Invalid proof cleanup key')
      const { error } = await client.storage.from(bucket).remove([key])
      if (error) throw new Error('Private proof cleanup failed')
    },
    async read(key) {
      if (!/^[A-Za-z0-9][A-Za-z0-9/_.-]{0,511}$/.test(key) || key.endsWith('/') ||
        key.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Invalid private proof key')
      await checkReadiness()
      const { data, error } = await client.storage.from(bucket).download(key)
      if (error || !data || !data.size || data.size > MAX_PAYMENT_PROOF_BYTES ||
        !['image/png', 'image/jpeg'].includes(data.type.split(';', 1)[0].toLowerCase())) throw new Error('Private proof download failed')
      return { bytes: new Uint8Array(await data.arrayBuffer()), contentType: data.type }
    },
  }
  return { storage, checkReadiness }
}
