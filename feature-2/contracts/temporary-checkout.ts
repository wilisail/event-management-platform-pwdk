/** Temporary F2 acceptance connection. Preserve this contract when replacing its adapter. */
export interface CheckoutInput {
  purchaseId: string
  eventId: string
  items: { ticketTypeId: string; quantity: number }[]
  pointsRequested: number
  couponId?: string | null
  expectedSubtotal: number
  expectedTotal: number
}

export interface CustomerPurchase {
  id: string
  reference: string
  status: 'WAITING_FOR_PAYMENT' | 'WAITING_FOR_ADMIN_CONFIRMATION' | 'DONE' | 'REJECTED' | 'EXPIRED' | 'CANCELED'
  event: { id: string; title: string; date: string; location: string; venue: string }
  items: { ticketTypeId: string; name: string; quantity: number; unitPrice: number; lineTotal: number }[]
  subtotal: number
  voucherDiscount: number
  pointsUsed: number
  couponDiscount: number
  totalPrice: number
  paymentDueAt: string | null
  proofUploadedAt: string | null
  decisionDueAt: string | null
  completedAt: string | null
  createdAt: string
  serverTime: string
  paymentInstructions: { bank: string; accountNumber: string; accountName: string } | null
}
