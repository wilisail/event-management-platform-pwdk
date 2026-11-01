import { createHash, createHmac, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { hashPassword, newPasswordSchema, PasswordWorkLimitError } from './passwords'
import type { Mailer } from '../email/resend'

export const RESET_SECONDS = 15 * 60
export const RESET_REQUEST_MESSAGE = 'Jika email terdaftar, tautan pemulihan akan dikirim. Periksa juga folder spam.'
export const resetDigest = (value: string) => createHash('sha256').update(value).digest('hex')
export interface ResetRecord {
  id: string; userId: string | null; recipientEmail: string; tokenHash: string; credentialFingerprint: string | null
  createdAt: Date; expiresAt: Date; consumedAt: Date | null
  deliveryState: string; attemptCount: number; leaseId: string | null; leasedUntil: Date | null; nextAttemptAt: Date
}
export interface ResetRepository {
  /** Same durable insert/cooldown for known and unknown addresses; no account lookup. */
  enqueue(email: string, input: { id: string; tokenHash: string }): Promise<void>
  claim(): Promise<ResetRecord | null>
  /** Activate under user -> token locks, fencing password changes and expired worker leases. */
  activate(job: ResetRecord, expectedHash: string): Promise<ResetRecord | null>
  finish(job: ResetRecord, accepted: boolean): Promise<void>
  prune(): Promise<void>
  candidate(tokenHash: string): Promise<ResetRecord | null>
  redeem(input: { id: string; userId: string; tokenHash: string; nextHash: string }): Promise<boolean>
}
export class PasswordResetError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message) }
}
const requestInput = z.strictObject({ email: z.string().trim().toLowerCase().max(254).pipe(z.email()) })
const resetInput = z.strictObject({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), newPassword: newPasswordSchema })
const invalidLink = () => new PasswordResetError(400, 'INVALID_RESET_LINK', 'Tautan tidak valid atau sudah berakhir. Minta tautan baru.')

export function resetOrigin(env: Record<string, string | undefined> = process.env) {
  const value = env.F2_PASSWORD_RESET_ORIGIN || (env.VERCEL_ENV === 'preview' && env.VERCEL_URL
    ? 'https://' + env.VERCEL_URL : env.NODE_ENV !== 'production' ? 'http://localhost:3001' : undefined)
  if (!value) return undefined
  const url = new URL(value)
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
    !(url.protocol === 'https:' || (env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) {
    throw new Error('Use a trusted reset application origin')
  }
  return url.origin
}

export function createPasswordResetService(options: { repository: ResetRepository; mailer: Mailer; origin: string; signingSecret: string;
  now?: () => Date; hash?: typeof hashPassword; onDeliveryFailure?: () => void }) {
  const origin = resetOrigin({ F2_PASSWORD_RESET_ORIGIN: options.origin })!
  if (Buffer.byteLength(options.signingSecret) < 32) throw new Error('A strong backend signing secret is required')
  // Independent cryptographic domain from session JWT signing. Stable retries need no plaintext token at rest.
  const key = createHmac('sha256', options.signingSecret).update('temuevent/password-reset/v1').digest()
  const tokenFor = (id: string) => createHmac('sha256', key).update(id).digest('base64url')
  const now = options.now ?? (() => new Date())
  let flight: Promise<void> | undefined
  async function drain() {
    await options.repository.prune()
    for (let count = 0; count < 5; count++) {
      const claimed = await options.repository.claim()
      if (!claimed) break
      const token = tokenFor(claimed.id)
      const job = await options.repository.activate(claimed, resetDigest(token))
      if (!job) continue
      const link = origin + '/reset-password#token=' + token
      let accepted = false
      try {
        await options.mailer.send({ to: job.recipientEmail, subject: 'Pulihkan kata sandi TemuEvent',
          text: 'Gunakan tautan ini untuk memilih kata sandi baru. Berlaku 15 menit sejak permintaan dan hanya sekali.\n\n' + link +
            '\n\nJika kamu tidak meminta perubahan ini, abaikan email ini. Kata sandi belum berubah.',
          html: '<h1>Pulihkan kata sandi</h1><p>Pilih kata sandi baru melalui tautan berikut. Berlaku 15 menit sejak permintaan dan hanya sekali.</p><p><a href="' +
            link + '">Pulihkan kata sandi TemuEvent</a></p><p>Jika kamu tidak meminta perubahan ini, abaikan email ini. Kata sandi belum berubah.</p>',
          idempotencyKey: 'password-reset/' + job.id })
        accepted = true
      } catch { options.onDeliveryFailure?.() }
      await options.repository.finish(job, accepted)
    }
  }
  return {
    async request(input: unknown): Promise<void> {
      const parsed = requestInput.safeParse(input)
      if (!parsed.success) throw new PasswordResetError(400, 'INVALID_RESET_EMAIL', 'Masukkan alamat email yang valid.')
      const id = randomUUID()
      await options.repository.enqueue(parsed.data.email, { id, tokenHash: resetDigest(tokenFor(id)) })
    },
    dispatchPending(): Promise<void> {
      if (!flight) flight = drain().catch(() => { options.onDeliveryFailure?.() }).finally(() => { flight = undefined })
      return flight
    },
    async reset(input: unknown): Promise<void> {
      const parsed = resetInput.safeParse(input)
      if (!parsed.success) throw new PasswordResetError(400, 'INVALID_PASSWORD_RESET', 'Periksa tautan dan gunakan kata sandi baru dengan 15–128 karakter.')
      const tokenHash = resetDigest(parsed.data.token)
      const record = await options.repository.candidate(tokenHash)
      if (!record?.userId || record.consumedAt || record.expiresAt <= now()) throw invalidLink()
      let nextHash: string
      try { nextHash = await (options.hash ?? hashPassword)(parsed.data.newPassword) }
      catch (error) {
        if (error instanceof PasswordWorkLimitError) throw new PasswordResetError(503, 'AUTH_BUSY', 'Pemrosesan kata sandi sedang sibuk. Coba lagi sebentar.')
        throw error
      }
      if (!await options.repository.redeem({ id: record.id, userId: record.userId, tokenHash, nextHash })) throw invalidLink()
    },
  }
}
export type PasswordResetService = ReturnType<typeof createPasswordResetService>
