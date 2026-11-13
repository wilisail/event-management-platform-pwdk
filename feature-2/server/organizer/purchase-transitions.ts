import { z } from 'zod'
import type { PrismaClient } from '../../generated/prisma/client'
import type { OrganizerDecisionTransition } from './decision'
import { customerRewards } from '../rewards/operations'
import { enqueueOrganizerDecisionEmail } from '../email/organizer-decision-repository'

type Action = 'ACCEPT' | 'REJECT' | 'EXPIRE' | 'CANCEL'
type Result = 'APPLIED' | 'NOT_FOUND' | 'CLOSED'
type LockedPurchase = {
  status: string; eventId: string; voucherDiscount: bigint
  paymentDueAt: Date | null; decisionDueAt: Date | null; hasProof: boolean
}

/** Shared lifecycle for persisted F1-contract purchases. Checkout/proof upload remain F1-owned. */
export function prismaPurchaseTransitions(db: PrismaClient, options: { deadlineStartAt?: Date } = {}) {
  const startAt = options.deadlineStartAt ?? new Date(0)
  if (!Number.isFinite(+startAt)) throw new Error('Invalid purchase deadline cutover')

  const apply = async (id: string, action: Action, organizerId?: string): Promise<Result> => {
    if (!z.uuid().safeParse(id).success || organizerId !== undefined && !z.uuid().safeParse(organizerId).success) return 'NOT_FOUND'
    // This lookup is advisory. Repeat ownership/customer identity under the purchase lock.
    const candidate = await db.purchase.findFirst({ where: { id,
      ...(organizerId ? { event: { organizerId } } : {}) }, select: { customerId: true } })
    if (!candidate) return 'NOT_FOUND'
    return db.$transaction(async tx => {
      // The same customer-first order is required of checkout, decisions and deadline execution.
      let at = new Date()
      const rewards = await customerRewards(tx, candidate.customerId, { now: () => at })
      const [purchase] = await tx.$queryRaw<LockedPurchase[]>`
        SELECT p.status::text AS status, p.event_id AS "eventId", p.voucher_discount AS "voucherDiscount",
          p.payment_due_at AS "paymentDueAt", p.decision_due_at AS "decisionDueAt",
          (p.payment_proof_key IS NOT NULL AND btrim(p.payment_proof_key) <> '' AND p.proof_uploaded_at IS NOT NULL) AS "hasProof"
        FROM temuevent.purchases p JOIN temuevent.events e ON e.id = p.event_id
        JOIN temuevent.users o ON o.id = e.organizer_id AND o.role = 'ORGANIZER'
        WHERE p.id = ${id}::uuid AND p.customer_id = ${candidate.customerId}::uuid
          AND (${organizerId ?? null}::uuid IS NULL OR e.organizer_id = ${organizerId ?? null}::uuid)
        FOR UPDATE OF p`
      if (!purchase) return 'NOT_FOUND'
      // Read the database clock after all preceding lock waits, not the request's earlier time.
      const [clock] = await tx.$queryRaw<{ at: Date }[]>`SELECT clock_timestamp() AS at`
      at = clock.at
      const decision = action === 'ACCEPT' || action === 'REJECT'
      const permitted = decision
        ? purchase.status === 'WAITING_FOR_ADMIN_CONFIRMATION' && purchase.hasProof && purchase.decisionDueAt && purchase.decisionDueAt > at
        : action === 'EXPIRE'
          ? purchase.status === 'WAITING_FOR_PAYMENT' && purchase.paymentDueAt && purchase.paymentDueAt <= at
          : purchase.status === 'WAITING_FOR_ADMIN_CONFIRMATION' && purchase.decisionDueAt && purchase.decisionDueAt <= at
      if (!permitted) return 'CLOSED'
      // No event-voucher reservation identity exists in the shared schema yet. Do not invent one.
      if (purchase.voucherDiscount !== 0n) throw new Error('Event-voucher lifecycle adapter is required')
      const items = await tx.purchaseItem.findMany({ where: { purchaseId: id }, orderBy: { ticketTypeId: 'asc' } })
      if (!items.length) throw new Error('A purchase must have reserved ticket items')
      const status = action === 'ACCEPT' ? 'DONE' : action === 'REJECT' ? 'REJECTED' : action === 'EXPIRE' ? 'EXPIRED' : 'CANCELED'
      await tx.purchase.update({ where: { id }, data: { status, completedAt: status === 'DONE' ? at : null } })
      if (status === 'DONE') await rewards.consume(id)
      else {
        await rewards.restore(id)
        for (const item of items) {
          const count = await tx.$executeRaw`
            UPDATE temuevent.ticket_types SET available_seats = available_seats + ${item.quantity}, updated_at = ${at}
            WHERE id = ${item.ticketTypeId}::uuid AND event_id = ${purchase.eventId}::uuid
              AND available_seats + ${item.quantity} <= quota`
          if (count !== 1) throw new Error('Reserved ticket accounting is inconsistent')
        }
      }
      // SQL state, rewards, seats and the notification commit together. Transport runs later.
      if (action === 'ACCEPT' || action === 'REJECT') await enqueueOrganizerDecisionEmail(tx, id, action)
      return 'APPLIED'
    }, { timeout: 10000 })
  }

  let pending: Promise<boolean> | undefined
  const dispatchDeadlines = (): Promise<boolean> => pending ??= (async () => {
    try {
      const rows = await db.$queryRaw<{ id: string; status: string }[]>`
        SELECT id, status::text AS status FROM temuevent.purchases
        WHERE created_at >= ${startAt}
          AND ((status = 'WAITING_FOR_PAYMENT' AND payment_due_at <= clock_timestamp())
            OR (status = 'WAITING_FOR_ADMIN_CONFIRMATION' AND decision_due_at <= clock_timestamp()))
        ORDER BY COALESCE(decision_due_at, payment_due_at), id LIMIT 25`
      let success = true
      for (const row of rows) {
        try { await apply(row.id, row.status === 'WAITING_FOR_PAYMENT' ? 'EXPIRE' : 'CANCEL') }
        catch { success = false }
      }
      if (!success) console.warn({ event: 'purchase_deadline_transition_failed' })
      return success
    } catch {
      console.warn({ event: 'purchase_deadline_scan_failed' })
      return false
    }
  })().finally(() => { pending = undefined })

  const decide: OrganizerDecisionTransition = input => apply(input.transactionId, input.decision, input.organizerId)
  return { decide, dispatchDeadlines }
}
