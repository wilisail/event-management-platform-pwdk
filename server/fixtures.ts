import type { OrganizerView, PointGrant, RewardCoupon, UserView } from '../contracts/types'
import { addCalendarMonths, makeReferralGrant } from '../domain/rewards'

export interface DemoData {
  customer: UserView
  organizerUser: UserView
  organizer: OrganizerView
  pointGrants: PointGrant[]
  coupons: RewardCoupon[]
}

export function createDemoData(asOf: Date): DemoData {
  const customer: UserView = {
    id: 'demo-customer-001',
    name: 'Ayu Pratiwi',
    email: 'ayu@example.test',
    role: 'CUSTOMER',
    profilePictureUrl: null,
    referralCode: 'AYU7K2P',
  }
  const organizerUser: UserView = {
    id: 'demo-organizer-001',
    name: 'Jakarta Coffee Collective',
    email: 'organizer@example.test',
    role: 'ORGANIZER',
    profilePictureUrl: null,
    referralCode: 'JCC9M4K',
  }
  const daysAgo = (days: number) => new Date(asOf.getTime() - days * 86_400_000)
  const coupons = [
    { id: 'coupon-welcome-001', code: 'WELCOME25', discountValue: 25000, issuedAt: daysAgo(15) },
    { id: 'coupon-expired-001', code: 'EXPIRED10', discountValue: 10000, issuedAt: daysAgo(150) },
  ].map((item) => ({
    ...item,
    userId: customer.id,
    discountType: 'FIXED_AMOUNT' as const,
    issuedAt: item.issuedAt.toISOString(),
    expiresAt: addCalendarMonths(item.issuedAt, 3).toISOString(),
    usedAt: null,
  }))
  return {
    customer,
    organizerUser,
    coupons,
    organizer: {
      id: organizerUser.id,
      name: organizerUser.name,
      profilePictureUrl: null,
      bio: 'Komunitas kopi yang mempertemukan roaster lokal, barista, dan pencinta kopi.',
      ratingSummary: null,
    },
    pointGrants: [
      makeReferralGrant('grant-active-001', customer.id, daysAgo(25)),
      makeReferralGrant('grant-active-002', customer.id, daysAgo(55)),
      makeReferralGrant('grant-expired-001', customer.id, daysAgo(150)),
    ],
  }
}
