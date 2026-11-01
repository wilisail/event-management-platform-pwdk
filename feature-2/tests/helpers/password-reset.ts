import { randomUUID } from 'node:crypto'
import { createPasswordResetService, resetDigest, type ResetRecord, type ResetRepository } from '../../server/auth/password-reset'
import type { EmailMessage, Mailer } from '../../server/email/resend'
import { passwordFixture } from './password-change'
import { testSecret } from './sessions'

export function resetFixture() {
  const f = passwordFixture(), jobs = new Map<string, ResetRecord>(), mail: EmailMessage[] = []
  const account = (email: string) => f.users.get(email)
  const eligible = (job: ResetRecord) => !job.consumedAt && job.expiresAt > f.now() &&
    job.userId && job.credentialFingerprint === resetDigest(account(job.recipientEmail)?.passwordHash ?? '')
  const repository: ResetRepository = {
    async enqueue(email, input) {
      const recent = [...jobs.values()].filter(j => j.recipientEmail === email && j.createdAt.getTime() > f.now().getTime() - 3600000)
      if (recent.length >= 3 || recent.some(j => j.createdAt.getTime() > f.now().getTime() - 60000)) return
      jobs.set(input.id, { ...input, recipientEmail: email, userId: null, credentialFingerprint: null,
        createdAt: f.now(), expiresAt: new Date(f.now().getTime() + 900000), consumedAt: null,
        deliveryState: 'PENDING', attemptCount: 0, leaseId: null, leasedUntil: null, nextAttemptAt: f.now() })
    },
    async claim() {
      const job = [...jobs.values()].find(j => !j.consumedAt && j.expiresAt > f.now() && j.attemptCount < 3 &&
        (['PENDING', 'RETRY'].includes(j.deliveryState) && j.nextAttemptAt <= f.now() || j.deliveryState === 'SENDING' && j.leasedUntil! <= f.now()))
      if (!job) return null
      Object.assign(job, { deliveryState: 'SENDING', attemptCount: job.attemptCount + 1, leaseId: randomUUID(), leasedUntil: new Date(f.now().getTime() + 60000) })
      return { ...job }
    },
    async activate(job, digest) {
      const stored = jobs.get(job.id)!, user = account(job.recipientEmail)
      if (stored.leaseId !== job.leaseId || stored.deliveryState !== 'SENDING') return null
      if (!user?.passwordHash || stored.consumedAt || stored.expiresAt <= f.now() || stored.tokenHash !== digest ||
        stored.userId && !eligible(stored)) { stored.deliveryState = 'SUPPRESSED'; return null }
      stored.userId = user.id; stored.credentialFingerprint = resetDigest(user.passwordHash)
      return { ...stored }
    },
    async finish(job, accepted) {
      const stored = jobs.get(job.id)!
      if (stored.leaseId !== job.leaseId || stored.deliveryState !== 'SENDING') return
      Object.assign(stored, { deliveryState: accepted ? 'ACCEPTED' : job.attemptCount < 3 ? 'RETRY' : 'FAILED',
        leaseId: null, leasedUntil: null, nextAttemptAt: new Date(f.now().getTime() + 5000 * 2 ** (job.attemptCount - 1)) })
    },
    async prune() {},
    async candidate(digest) { const job = [...jobs.values()].find(j => j.tokenHash === digest); return job && eligible(job) ? { ...job } : null },
    async redeem(input) {
      const job = jobs.get(input.id)
      if (!job || job.userId !== input.userId || job.tokenHash !== input.tokenHash || !eligible(job)) return false
      account(job.recipientEmail)!.passwordHash = input.nextHash
      for (const other of jobs.values()) if (other.recipientEmail === job.recipientEmail && !other.consumedAt) other.consumedAt = f.now()
      for (const session of f.sessions.values()) if (session.user.id === job.userId) session.revokedAt = f.now()
      return true
    },
  }
  const mailer: Mailer = { async send(message) { mail.push(message) } }
  const service = (options: { mailer?: Mailer; repository?: ResetRepository; hash?: typeof f.hash; signingSecret?: string } = {}) =>
    createPasswordResetService({ repository, mailer, origin: 'https://temuevent.example', signingSecret: testSecret,
      hash: f.hash, now: f.now, ...options })
  return { ...f, jobs, mail, mailer, resetRepository: repository, resetService: service(), makeResetService: service }
}
export function messageToken(message: EmailMessage) { return message.text.match(/#token=([A-Za-z0-9_-]{43})/)![1] }
