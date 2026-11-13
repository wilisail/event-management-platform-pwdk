/** Shared account shapes. Registration writes are implemented; demo routes remain fixtures. */
export type Role = 'CUSTOMER' | 'ORGANIZER'
export type DemoPersona = 'customer' | 'organizer'

export interface UserView {
  id: string
  name: string
  email: string
  role: Role
  profilePictureUrl: string | null
  referralCode: string
}

export interface PointGrant {
  id: string
  userId: string
  amount: number
  remainingAmount: number
  creditedAt: string
  expiresAt: string
  source: 'REFERRAL'
}

export interface RewardCoupon {
  id: string
  userId: string
  code: string
  discountType: 'FIXED_AMOUNT'
  discountValue: number
  issuedAt: string
  expiresAt: string
  usedAt: string | null
}

export interface CouponView extends RewardCoupon {
  status: 'AVAILABLE' | 'EXPIRED' | 'USED'
}

export interface WalletView {
  userId: string
  asOf: string
  currency: 'IDR'
  availablePoints: number
  pointValueIdr: 1
  pointGrants: PointGrant[]
  coupons: CouponView[]
  policy: {
    referralAwardPoints: 10000
    validityCalendarMonths: 3
    couponAmountIsDemo: true
  }
}

export interface OrganizerView {
  id: string
  name: string
  bio: string
  profilePictureUrl: string | null
  /** F1 owns review/rating calculation. Null means not connected yet. */
  ratingSummary: { average: number; count: number } | null
}

export interface EventReviewEligibility {
  eligible: boolean
  reason: 'ELIGIBLE' | 'PURCHASE_REQUIRED' | 'ATTENDANCE_REQUIRED' | 'ALREADY_REVIEWED'
}

export interface EventReviewView {
  id: string
  eventId: string
  userId: string
  reviewerName: string
  rating: number
  comment: string | null
  createdAt: string
}

export interface CheckoutContext {
  user: UserView
  rewards: WalletView
}

export interface ApiSuccess<T> {
  success: true
  message: string
  data: T
  meta: { mode: 'demo'; contractVersion: '0.1-proposal'; asOf: string }
}

export interface ApiFailure {
  success: false
  message: string
  code: string
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

/** Incoming referral codes are optional; the account, referral and rewards commit together. */
export interface RegistrationRequest {
  name: string
  email: string
  password: string
  role?: Role
  referralCode?: string
}

export interface RegistrationSuccess {
  success: true
  message: string
  data: { user: UserView }
}

export interface LoginRequest { email: string; password: string }

/** Access/refresh secrets are Set-Cookie headers, never JSON or browser storage. */
export interface LoginSuccess {
  success: true
  message: string
  data: {
    user: UserView
    csrfToken: string
    accessExpiresAt: string
    sessionExpiresAt: string
  }
}

export interface PageView<T> {
  items: T[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

/** Database-backed wallet reads. Demo WalletView stays separate at /api/demo. */
export interface WalletPointGrantView {
  id: string
  amount: number
  remainingAmount: number
  creditedAt: string
  expiresAt: string
  status: 'AVAILABLE' | 'EXPIRED' | 'EMPTY' | 'PENDING'
}

export interface WalletCouponView {
  id: string
  code: string
  discountType: 'FIXED_AMOUNT'
  discountValue: number
  issuedAt: string
  expiresAt: string
  status: 'AVAILABLE' | 'RESERVED' | 'USED' | 'EXPIRED' | 'PENDING'
}

export interface AccountWalletView {
  userId: string
  asOf: string
  currency: 'IDR'
  availablePoints: number
  availableCouponCount: number
  pointValueIdr: 1
  pointGrants: PageView<WalletPointGrantView>
  coupons: PageView<WalletCouponView>
}

export interface ReferralSummaryView {
  code: string
  referredCount: number
  referralAwardPoints: 10000
  validityCalendarMonths: 3
}

export interface EventSummaryView {
  id: string
  name: string
  category: string
  location: string
  venue: string
  startAt: string
  endAt: string
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELED'
}

/** One confirmed purchase, not an attendance/check-in record. */
export interface AttendeePurchaseView {
  purchaseId: string
  purchaseReference: string
  customerId: string
  name: string
  ticketQuantity: number
  totalPaid: number
  attendedAt: string | null
}

export interface AttendanceView {
  eventId: string
  customerId: string
  transactionId: string
  attendedAt: string
}

export const PURCHASE_STATUSES = [
  'WAITING_FOR_PAYMENT', 'WAITING_FOR_ADMIN_CONFIRMATION', 'DONE',
  'REJECTED', 'EXPIRED', 'CANCELED',
] as const

export type PurchaseStatus = typeof PURCHASE_STATUSES[number]
export type OrganizerDecision = 'ACCEPT' | 'REJECT'
export type OrganizerDecisionAvailability = 'READY' | 'CLOSED' | 'UNAVAILABLE'
export interface OrganizerDecisionResult { id: string; status: 'DONE' | 'REJECTED' }

export interface OrganizerTransactionView {
  id: string
  reference: string
  eventName: string
  customerName: string
  status: PurchaseStatus
  totalPrice: number
  createdAt: string
}

export interface OrganizerTransactionDetail extends OrganizerTransactionView {
  decisionAvailability: OrganizerDecisionAvailability
  proofAvailability?: 'NONE' | 'READY' | 'UNAVAILABLE'
  subtotal: number
  voucherDiscount: number
  couponDiscount: number
  pointsUsed: number
  paymentDueAt: string | null
  decisionDueAt: string | null
  proofUploadedAt: string | null
  completedAt: string | null
  items: { id: string; ticketName: string; quantity: number; unitPrice: number; lineTotal: number }[]
}

export const STATISTICS_GROUPS = ['day', 'month', 'year'] as const
export type StatisticsGroup = typeof STATISTICS_GROUPS[number]
export interface OrganizerStatisticsRange { groupBy: StatisticsGroup; from: string; to: string }
export interface OrganizerStatisticsTotals { revenueIdr: number; purchaseCount: number; ticketQuantity: number }
export interface OrganizerStatisticsView extends OrganizerStatisticsRange {
  timeZone: 'Asia/Jakarta'
  totals: OrganizerStatisticsTotals
  periods: (OrganizerStatisticsTotals & { startDate: string })[]
}

