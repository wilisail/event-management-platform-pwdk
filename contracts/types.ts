/** Proposed shared shape. Real authentication and write APIs are not implemented here. */
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
