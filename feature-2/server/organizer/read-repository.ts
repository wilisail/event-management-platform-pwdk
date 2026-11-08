import type { Prisma, PrismaClient } from '../../generated/prisma/client'
import type { OrganizerReadRepository } from './reads'
import { prismaOrganizerStatistics } from './statistics'
import { prismaMarkAttendance } from './attendance'

export const integerIdr = (amount: bigint): number => {
  if (amount < 0n || amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('IDR amount outside safe JSON range')
  return Number(amount)
}
const pagination = (page: number, pageSize: number, total: number) => ({
  page, pageSize, total, totalPages: Math.ceil(total / pageSize),
})

const transactionSelect = {
  id: true, reference: true, status: true, totalPrice: true, createdAt: true,
  event: { select: { name: true } }, customer: { select: { name: true } },
} satisfies Prisma.PurchaseSelect

function transactionView(purchase: Prisma.PurchaseGetPayload<{ select: typeof transactionSelect }>) {
  return {
    id: purchase.id, reference: purchase.reference, status: purchase.status,
    eventName: purchase.event.name, customerName: purchase.customer.name,
    totalPrice: integerIdr(purchase.totalPrice), createdAt: purchase.createdAt.toISOString(),
  }
}

export function prismaOrganizerReadRepository(
  db: Pick<PrismaClient, 'event' | 'purchase' | 'attendance' | '$queryRaw'>,
): OrganizerReadRepository {
  return {
    statistics: prismaOrganizerStatistics(db),
    markAttendance: prismaMarkAttendance(db),
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
      const customerIds = [...new Set(purchases.map(purchase => purchase.customer.id))]
      const attendance = customerIds.length ? await db.attendance.findMany({ where: {
        eventId, customerId: { in: customerIds }, eventPurchase: { status: 'DONE', event: { organizerId } },
      }, select: { customerId: true, attendedAt: true } }) : []
      const attendedAt = new Map(attendance.map(record => [record.customerId, record.attendedAt.toISOString()]))
      return { items: purchases.map(purchase => {
        const ticketQuantity = purchase.items.reduce((sum, item) => sum + item.quantity, 0)
        if (!Number.isSafeInteger(ticketQuantity)) throw new Error('Ticket quantity outside safe JSON range')
        return {
          purchaseId: purchase.id, purchaseReference: purchase.reference,
          customerId: purchase.customer.id, name: purchase.customer.name,
          ticketQuantity, totalPaid: integerIdr(purchase.totalPrice),
          attendedAt: attendedAt.get(purchase.customer.id) ?? null,
        }
      }), pagination: pagination(page, pageSize, total) }
    },
    transactions: {
      async decisionState(organizerId, transactionId) {
        const purchase = await db.purchase.findFirst({ where: { id: transactionId, event: { organizerId } },
          select: { status: true, decisionDueAt: true } })
        return purchase ? { status: purchase.status, decisionDueAt: purchase.decisionDueAt?.toISOString() ?? null } : null
      },
      async list(organizerId, { page, pageSize, status }) {
        const where = { event: { organizerId }, ...(status ? { status } : {}) }
        const [purchases, total] = await Promise.all([
          db.purchase.findMany({ where, select: transactionSelect,
            skip: (page - 1) * pageSize, take: pageSize,
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          }),
          db.purchase.count({ where }),
        ])
        return { items: purchases.map(transactionView), pagination: pagination(page, pageSize, total) }
      },
      async detail(organizerId, transactionId) {
        const purchase = await db.purchase.findFirst({
          where: { id: transactionId, event: { organizerId } },
          select: {
            ...transactionSelect,
            subtotal: true, voucherDiscount: true, couponDiscount: true, pointsUsed: true,
            paymentDueAt: true, decisionDueAt: true, proofUploadedAt: true, completedAt: true,
            items: { orderBy: { id: 'asc' }, select: {
              id: true, quantity: true, unitPrice: true, lineTotal: true,
              ticketType: { select: { name: true } },
            } },
          },
        })
        if (!purchase) return null
        return {
          ...transactionView(purchase),
          subtotal: integerIdr(purchase.subtotal), voucherDiscount: integerIdr(purchase.voucherDiscount),
          couponDiscount: integerIdr(purchase.couponDiscount), pointsUsed: integerIdr(purchase.pointsUsed),
          paymentDueAt: purchase.paymentDueAt?.toISOString() ?? null,
          decisionDueAt: purchase.decisionDueAt?.toISOString() ?? null,
          proofUploadedAt: purchase.proofUploadedAt?.toISOString() ?? null,
          completedAt: purchase.completedAt?.toISOString() ?? null,
          items: purchase.items.map(item => ({
            id: item.id, ticketName: item.ticketType.name, quantity: item.quantity,
            unitPrice: integerIdr(item.unitPrice), lineTotal: integerIdr(item.lineTotal),
          })),
        }
      },
    },
  }
}
