import type { OrganizerDecision, OrganizerDecisionAvailability, PurchaseStatus } from '../../contracts/types'

export interface OrganizerDecisionState {
  status: PurchaseStatus
  decisionDueAt: string | null
}

/** Integration port. The engine must check ownership, status and the fresh deadline
 * inside its transaction with stock, voucher, reward and notification writes. */
export type OrganizerDecisionTransition = (input: {
  organizerId: string
  transactionId: string
  decision: OrganizerDecision
}) => Promise<'APPLIED' | 'NOT_FOUND' | 'CLOSED'>

export function decisionAvailability(
  purchase: OrganizerDecisionState,
  now: Date,
  transition: OrganizerDecisionTransition | undefined,
): OrganizerDecisionAvailability {
  const deadline = purchase.decisionDueAt ? Date.parse(purchase.decisionDueAt) : NaN
  if (purchase.status !== 'WAITING_FOR_ADMIN_CONFIRMATION' || !(deadline > now.getTime())) return 'CLOSED'
  return transition ? 'READY' : 'UNAVAILABLE'
}
