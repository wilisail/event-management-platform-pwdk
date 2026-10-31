import { randomUUID } from 'node:crypto'
import type { Prisma } from '../../generated/prisma/client'
import type { CustomerRewards, RewardQuote, RewardSelection } from '../../server/rewards/operations'

/** Disposable test fixtures; this is not feature 1's checkout/seat engine. */
export async function rewardFixture(tx: Prisma.TransactionClient, at: Date, tag = randomUUID()) {
  const user = async (label: string, role: 'CUSTOMER' | 'ORGANIZER' = 'CUSTOMER') => tx.user.create({ data: {
    name: 'Reward operations ' + label, email: 'reward-ops-' + label + '-' + tag + '@example.test', role,
    referralCode: randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase(),
  } })
  const owner = await user('owner'), sponsor = await user('sponsor'), other = await user('other'), organizer = await user('organizer', 'ORGANIZER')
  const incoming = await tx.referral.create({ data: { referrerId: sponsor.id, referredUserId: owner.id } })
  const coupon = await tx.rewardCoupon.create({ data: { referralId: incoming.id, userId: owner.id,
    code: 'OPS-' + randomUUID().replaceAll('-', '').slice(0, 24).toUpperCase(), discountValue: 25000n,
    issuedAt: new Date(at.getTime() - 86400000), expiresAt: new Date(at.getTime() + 90 * 86400000) } })
  const grants: { id: string; amount: bigint; remainingAmount: bigint; creditedAt: Date; expiresAt: Date }[] = []
  for (let index = 0; index < 4; index++) {
    const newcomer = await user('friend-' + index)
    const referral = await tx.referral.create({ data: { referrerId: owner.id, referredUserId: newcomer.id } })
    grants.push(await tx.pointGrant.create({ data: { referralId: referral.id, userId: owner.id, amount: 10000n, remainingAmount: 10000n,
      creditedAt: new Date(at.getTime() + (index === 3 ? 3600000 : -86400000)),
      expiresAt: new Date(at.getTime() + [3600000, 7200000, -1, 10800000][index]) } }))
  }
  const event = await tx.event.create({ data: { organizerId: organizer.id, slug: 'reward-ops-' + tag,
    name: 'Reward operations test', category: 'Learning', location: 'Jakarta',
    startAt: new Date(at.getTime() + 86400000), endAt: new Date(at.getTime() + 90000000), status: 'PUBLISHED' } })
  const ticket = await tx.ticketType.create({ data: { eventId: event.id, name: 'Test ticket', price: 100000n, quota: 100, availableSeats: 100 } })
  return { owner, other, organizer, coupon, grants, event, ticket, tag, at }
}
export type RewardFixture = Awaited<ReturnType<typeof rewardFixture>>

export async function testCheckout(tx: Prisma.TransactionClient, f: RewardFixture, rewards: CustomerRewards,
  selection: RewardSelection & { purchaseId?: string; subtotal?: number; voucherDiscount?: number },
  afterPurchase?: (quote: RewardQuote) => Promise<void>) {
  const purchaseId = selection.purchaseId ?? randomUUID()
  const input = { ...selection, purchaseId, subtotal: selection.subtotal ?? 100000, voucherDiscount: selection.voucherDiscount ?? 0 }
  const result = await rewards.reserveNewPurchase(input, async quote => {
    const seats = await tx.ticketType.updateMany({ where: { id: f.ticket.id, availableSeats: { gte: 1 } }, data: { availableSeats: { decrement: 1 } } })
    if (seats.count !== 1) throw new Error('TEST_NO_SEATS')
    await tx.purchase.create({ data: { id: purchaseId, reference: 'OPS-' + purchaseId, customerId: f.owner.id, eventId: f.event.id,
      subtotal: BigInt(quote.subtotal), voucherDiscount: BigInt(quote.voucherDiscount),
      couponDiscount: BigInt(quote.couponDiscount), pointsUsed: BigInt(quote.pointsUsed), totalPrice: BigInt(quote.totalPrice),
      status: quote.totalPrice ? 'WAITING_FOR_PAYMENT' : 'DONE',
      paymentDueAt: quote.totalPrice ? new Date(f.at.getTime() + 7200000) : null,
      completedAt: quote.totalPrice ? null : f.at } })
    await tx.purchaseItem.create({ data: { purchaseId, eventId: f.event.id, ticketTypeId: f.ticket.id,
      quantity: 1, unitPrice: BigInt(quote.subtotal), lineTotal: BigInt(quote.subtotal) } })
    await afterPurchase?.(quote)
  })
  return { result, purchaseId, input }
}
