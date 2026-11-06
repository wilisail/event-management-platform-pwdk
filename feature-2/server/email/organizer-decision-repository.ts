import { randomUUID } from 'node:crypto'
import type { Prisma, PrismaClient } from '../../generated/prisma/client'
import type { OrganizerDecision } from '../../contracts/types'
import { decisionEmailContent, MAX_DECISION_EMAIL_ATTEMPTS, type DecisionEmailJob, type DecisionEmailRepository } from './organizer-decision'

/** Call after the purchase update, inside the same transaction. A failure must abort the whole decision. */
export async function enqueueOrganizerDecisionEmail(tx: Prisma.TransactionClient, purchaseId: string, decision: OrganizerDecision) {
  const [transaction] = await tx.$queryRaw<{ id: string }[]>`SELECT pg_current_xact_id()::text AS id`
  const expectedStatus = decision === 'ACCEPT' ? 'DONE' : 'REJECTED'
  const [purchase] = await tx.$queryRaw<{ reference: string; email: string }[]>`
    SELECT p.reference, u.email
    FROM temuevent.purchases p JOIN temuevent.users u ON u.id = p.customer_id
    WHERE p.id = ${purchaseId}::uuid AND p.status = ${expectedStatus}::temuevent."PurchaseStatus"
      AND pg_current_xact_id()::text = ${transaction.id}`
  if (!purchase) throw new Error('Decision email requires a matching purchase in the current transaction')
  const result = await tx.organizerDecisionEmail.createMany({ data: {
    purchaseId, decision, recipientEmail: purchase.email, ...decisionEmailContent(purchase.reference, decision),
  }, skipDuplicates: true })
  if (result.count === 0) {
    const existing = await tx.organizerDecisionEmail.findUnique({ where: { purchaseId }, select: { decision: true } })
    if (existing?.decision !== decision) throw new Error('Purchase already has a different decision notification')
  }
}

export function prismaDecisionEmailRepository(db: Pick<PrismaClient, '$queryRaw' | '$executeRaw'>): DecisionEmailRepository {
  return {
    async claim() {
      const [job] = await db.$queryRaw<DecisionEmailJob[]>`
        WITH candidate AS (
          SELECT id FROM temuevent.organizer_decision_emails
          WHERE attempt_count < ${MAX_DECISION_EMAIL_ATTEMPTS}
            AND (retry_until IS NULL OR retry_until > CURRENT_TIMESTAMP)
            AND ((delivery_state IN ('PENDING','RETRY') AND next_attempt_at <= CURRENT_TIMESTAMP)
              OR (delivery_state = 'SENDING' AND leased_until <= CURRENT_TIMESTAMP))
          ORDER BY next_attempt_at, id LIMIT 1 FOR UPDATE SKIP LOCKED
        )
        UPDATE temuevent.organizer_decision_emails AS job SET
          delivery_state = 'SENDING', lease_id = ${randomUUID()}::uuid,
          leased_until = CURRENT_TIMESTAMP + interval '1 minute', attempt_count = attempt_count + 1,
          retry_until = COALESCE(retry_until, CURRENT_TIMESTAMP + interval '12 hours')
        FROM candidate WHERE job.id = candidate.id
        RETURNING job.id, recipient_email AS "recipientEmail", subject, text_body AS "textBody",
          html_body AS "htmlBody", lease_id AS "leaseId", attempt_count AS "attemptCount"`
      return job ?? null
    },
    async finish(job, outcome) {
      const delaySeconds = job.attemptCount === 1 ? 30 : 120
      await db.$executeRaw`
        UPDATE temuevent.organizer_decision_emails SET
          delivery_state = CASE WHEN ${outcome} = 'RETRY'
            AND retry_until <= CURRENT_TIMESTAMP + (${delaySeconds}::int * interval '1 second') THEN 'FAILED'
            ELSE ${outcome} END,
          accepted_at = CASE WHEN ${outcome} = 'ACCEPTED' THEN CURRENT_TIMESTAMP ELSE NULL END,
          lease_id = NULL, leased_until = NULL,
          next_attempt_at = CURRENT_TIMESTAMP + (${delaySeconds}::int * interval '1 second')
        WHERE id = ${job.id}::uuid AND lease_id = ${job.leaseId}::uuid AND delivery_state = 'SENDING'`
    },
    async closeExpiredAttempts() {
      await db.$executeRaw`
        UPDATE temuevent.organizer_decision_emails SET delivery_state = 'FAILED', lease_id = NULL, leased_until = NULL
        WHERE (delivery_state = 'SENDING' AND leased_until <= CURRENT_TIMESTAMP
          AND (attempt_count >= ${MAX_DECISION_EMAIL_ATTEMPTS} OR retry_until <= CURRENT_TIMESTAMP))
          OR (delivery_state = 'RETRY' AND retry_until <= CURRENT_TIMESTAMP)`
    },
  }
}
