/** Test-only substitute for unfinished F1 purchase transitions. Never imported by an application bootstrap. */
import type { PrismaClient } from '../../feature-2/generated/prisma/client'
import type { OrganizerDecisionTransition } from '../../feature-2/server/organizer/decision'
import { customerRewards } from '../../feature-2/server/rewards/operations'
import { enqueueOrganizerDecisionEmail } from '../../feature-2/server/email/organizer-decision-repository'

export interface Round5Fixture {
  purchaseId: string
  eventId: string
  customerId: string
  organizerId: string
}

export function round5QaTransitions(db: PrismaClient, fixtures: readonly Round5Fixture[], options: {
  now: () => Date
  beforeCommit?: (purchaseId: string) => void
  afterCommit?: (purchaseId: string) => void
}) {
  const allowed = new Map(fixtures.map(fixture => [fixture.purchaseId, Object.freeze({ ...fixture })]))
  if (allowed.size !== fixtures.length) throw new Error('Duplicate QA fixture identity')
  const apply = async (id: string, action: 'ACCEPT' | 'REJECT' | 'EXPIRE' | 'CANCEL', organizerId?: string) => {
    const fixture = allowed.get(id)
    if (!fixture || organizerId !== undefined && fixture.organizerId !== organizerId) return 'NOT_FOUND' as const
    const result = await db.$transaction(async tx => {
      // Match F2's documented lock order: customer rewards, purchase, then inventory.
      const rewards = await customerRewards(tx, fixture.customerId, { now: options.now })
      const [purchase] = await tx.$queryRaw<{
        status: string; paymentDueAt: Date | null; decisionDueAt: Date | null; hasProof: boolean
      }[]>`
        SELECT p.status::text AS status, p.payment_due_at AS "paymentDueAt", p.decision_due_at AS "decisionDueAt",
          (p.payment_proof_key IS NOT NULL AND p.proof_uploaded_at IS NOT NULL) AS "hasProof"
        FROM temuevent.purchases p JOIN temuevent.events e ON e.id = p.event_id
        WHERE p.id = ${id}::uuid AND p.customer_id = ${fixture.customerId}::uuid
          AND p.event_id = ${fixture.eventId}::uuid AND e.organizer_id = ${fixture.organizerId}::uuid
          AND p.reference = ${'ROUND5-QA-' + id}
        FOR UPDATE OF p`
      if (!purchase) return 'NOT_FOUND' as const
      const at = options.now()
      const decision = action === 'ACCEPT' || action === 'REJECT'
      const permitted = decision
        ? purchase.status === 'WAITING_FOR_ADMIN_CONFIRMATION' && purchase.hasProof && purchase.decisionDueAt && purchase.decisionDueAt > at
        : action === 'EXPIRE'
          ? purchase.status === 'WAITING_FOR_PAYMENT' && purchase.paymentDueAt && purchase.paymentDueAt <= at
          : purchase.status === 'WAITING_FOR_ADMIN_CONFIRMATION' && purchase.decisionDueAt && purchase.decisionDueAt <= at
      if (!permitted) return 'CLOSED' as const
      const status = action === 'ACCEPT' ? 'DONE' : action === 'REJECT' ? 'REJECTED' : action === 'EXPIRE' ? 'EXPIRED' : 'CANCELED'
      await tx.purchase.update({ where: { id }, data: { status, completedAt: status === 'DONE' ? at : null } })
      if (status === 'DONE') await rewards.consume(id)
      else {
        await rewards.restore(id)
        const items = await tx.purchaseItem.findMany({ where: { purchaseId: id }, orderBy: { ticketTypeId: 'asc' } })
        for (const item of items) await tx.ticketType.update({ where: { id: item.ticketTypeId }, data: { availableSeats: { increment: item.quantity } } })
      }
      if (decision) await enqueueOrganizerDecisionEmail(tx, id, action)
      options.beforeCommit?.(id)
      return 'APPLIED' as const
    }, { timeout: 10000 })
    if (result === 'APPLIED') options.afterCommit?.(id)
    return result
  }
  const decide: OrganizerDecisionTransition = input => apply(input.transactionId, input.decision, input.organizerId)
  return { decide, expire: (id: string) => apply(id, 'EXPIRE'), cancel: (id: string) => apply(id, 'CANCEL') }
}
