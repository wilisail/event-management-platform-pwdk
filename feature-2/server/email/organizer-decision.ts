import type { OrganizerDecision } from '../../contracts/types'
import { MailDeliveryError, type EmailMessage, type Mailer } from './resend'

export const MAX_DECISION_EMAIL_ATTEMPTS = 3

export interface DecisionEmailJob {
  id: string
  recipientEmail: string
  subject: string
  textBody: string
  htmlBody: string
  leaseId: string
  attemptCount: number
}

export interface DecisionEmailRepository {
  claim(): Promise<DecisionEmailJob | null>
  finish(job: DecisionEmailJob, outcome: 'ACCEPTED' | 'RETRY' | 'FAILED'): Promise<void>
  closeExpiredAttempts(): Promise<void>
}

export function decisionEmailContent(reference: string, decision: OrganizerDecision) {
  const accepted = decision === 'ACCEPT'
  const subject = accepted ? 'TemuEvent · Pembayaran diterima' : 'TemuEvent · Pembayaran ditolak'
  const textBody = `Pembayaran transaksi ${reference} ${accepted ? 'telah diterima' : 'ditolak'} oleh organizer. Periksa detail transaksi di TemuEvent.`
  const escaped = textBody.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!)
  return { subject, textBody, htmlBody: `<p>${escaped}</p>` }
}

export function createDecisionEmailWorker(repository: DecisionEmailRepository, mailer: Mailer, onFailure?: () => void) {
  let inFlight: Promise<boolean> | undefined

  async function dispatch() {
    await repository.closeExpiredAttempts()
    for (let i = 0; i < 5; i++) {
      const job = await repository.claim()
      if (!job) return
      const message: EmailMessage = {
        to: job.recipientEmail, subject: job.subject, text: job.textBody, html: job.htmlBody,
        idempotencyKey: 'organizer-decision/' + job.id,
      }
      let outcome: 'ACCEPTED' | 'RETRY' | 'FAILED' = 'ACCEPTED'
      try { await mailer.send(message) }
      catch (error) {
        const status = error instanceof MailDeliveryError ? error.httpStatus : undefined
        const retryable = status === undefined || status >= 500 || [408, 409, 429].includes(status)
        outcome = retryable && job.attemptCount < MAX_DECISION_EMAIL_ATTEMPTS ? 'RETRY' : 'FAILED'
      }
      await repository.finish(job, outcome)
      if (outcome === 'FAILED') onFailure?.()
    }
  }

  return {
    dispatchPending() {
      inFlight ??= dispatch().then(() => true, () => {
        onFailure?.()
        return false
      }).finally(() => { inFlight = undefined })
      return inFlight
    },
  }
}
