import type { PrismaClient } from '../../generated/prisma/client'
import type { OrganizerReadRepository } from './reads'

export const integerIdr = (amount: bigint): number => {
  if (amount < 0n || amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('IDR amount outside safe JSON range')
  return Number(amount)
}
const pagination = (page: number, pageSize: number, total: number) => ({
  page, pageSize, total, totalPages: Math.ceil(total / pageSize),
})

export function prismaOrganizerReadRepository(
  db: Pick<PrismaClient, 'event' | 'purchase'>,
): OrganizerReadRepository {
  return {
    async listEvents(organizerId, page, pageSize) {
      const where = { organizerId }
      const [events, total] = await Promise.all([
        db.event.findMany({ where, skip: (page - 1) * pageSize, take: pageSize,
          orderBy: [{ startAt: 'desc' }, { id: 'asc' }], select: {
            id: true, name: true, category: true, location: true, venue: true,
            startAt: true, endAt: true, status: true,
          } }),
        db.event.count({ where }),
      ])
      return { items: events.map(event => ({ ...event,
        startAt: event.startAt.toISOString(), endAt: event.endAt.toISOString(),
      })), pagination: pagination(page, pageSize, total) }
    },
    async eventBelongsTo(organizerId, eventId) {
      return Boolean(await db.event.findFirst({ where: { id: eventId, organizerId }, select: { id: true } }))
    },
    async listAttendees(organizerId, eventId, page, pageSize) {
      // Repeat the owner predicate on data/count queries; never query by event ID alone.
      const where = { eventId, event: { organizerId }, status: 'DONE' as const }
      const [purchases, total] = await Promise.all([
        db.purchase.findMany({ where, skip: (page - 1) * pageSize, take: pageSize,
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: {
            id: true, reference: true, totalPrice: true,
            customer: { select: { id: true, name: true } },
            items: { select: { quantity: true } },
          } }),
        db.purchase.count({ where }),
      ])
      return { items: purchases.map(purchase => {
        const ticketQuantity = purchase.items.reduce((sum, item) => sum + item.quantity, 0)
        if (!Number.isSafeInteger(ticketQuantity)) throw new Error('Ticket quantity outside safe JSON range')
        return {
          purchaseId: purchase.id, purchaseReference: purchase.reference,
          customerId: purchase.customer.id, name: purchase.customer.name,
          ticketQuantity, totalPaid: integerIdr(purchase.totalPrice),
        }
      }), pagination: pagination(page, pageSize, total) }
    },
  }
}
