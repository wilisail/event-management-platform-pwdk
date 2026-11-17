import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { z } from 'zod'
import type { Prisma, PrismaClient } from '../../generated/prisma/client'
import type { CheckoutInput, CustomerPurchase } from '../../contracts/temporary-checkout'
import { customerRewards } from '../rewards/operations'
import { rewardInteger } from '../rewards/reads'
import { checkedPaymentProof, type PaymentProofStorage } from '../organizer/private-proof'

export const MAX_CHECKOUT_PROOF_BYTES = 3 * 1024 * 1024
export class CheckoutError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message) }
}
const inputSchema = z.strictObject({
  purchaseId: z.uuid(), eventId: z.uuid(),
  items: z.array(z.strictObject({ ticketTypeId: z.uuid(), quantity: z.number().int().min(1).max(20) })).min(1).max(10),
  pointsRequested: z.number().int().min(0).max(100_000_000), couponId: z.uuid().nullable().optional(),
  expectedSubtotal: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  expectedTotal: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
})
const conflict = () => new CheckoutError(409, 'CHECKOUT_CHANGED', 'Pesanan berubah. Periksa tiket dan saldo lalu coba lagi.')
const notFound = () => new CheckoutError(404, 'PURCHASE_NOT_FOUND', 'Pesanan tidak ditemukan.')
const purchaseData = { event: true, items: { include: { ticketType: true }, orderBy: { ticketTypeId: 'asc' } } } as const
type PurchaseRow = Prisma.PurchaseGetPayload<{ include: typeof purchaseData }>
export type CheckoutService = ReturnType<typeof prismaTemporaryCheckout>

/** TEMPORARY: supports F2 acceptance using the shared purchase contract; retained until a verified replacement. */
export function prismaTemporaryCheckout(db: PrismaClient, storage: PaymentProofStorage,
  instructions: CustomerPurchase['paymentInstructions'] = null) {
  function present(row: PurchaseRow, at: Date): CustomerPurchase {
    return { id: row.id, reference: row.reference, status: row.status,
      event: { id: row.event.id, title: row.event.name, date: row.event.startAt.toISOString(), location: row.event.location, venue: row.event.venue },
      items: row.items.map(item => ({ ticketTypeId: item.ticketTypeId, name: item.ticketType.name,
        quantity: item.quantity, unitPrice: rewardInteger(item.unitPrice), lineTotal: rewardInteger(item.lineTotal) })),
      subtotal: rewardInteger(row.subtotal), voucherDiscount: rewardInteger(row.voucherDiscount), pointsUsed: rewardInteger(row.pointsUsed),
      couponDiscount: rewardInteger(row.couponDiscount), totalPrice: rewardInteger(row.totalPrice),
      paymentDueAt: row.paymentDueAt?.toISOString() ?? null, proofUploadedAt: row.proofUploadedAt?.toISOString() ?? null,
      decisionDueAt: row.decisionDueAt?.toISOString() ?? null, completedAt: row.completedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(), serverTime: at.toISOString(), paymentInstructions: instructions }
  }
  async function detail(customerId: string, id: string): Promise<CustomerPurchase> {
    const row = await db.purchase.findFirst({ where: { id, customerId }, include: purchaseData })
    if (!row) throw notFound()
    const [{ at }] = await db.$queryRaw<{ at: Date }[]>`SELECT clock_timestamp() AS at`
    return present(row, at)
  }
  async function create(customerId: string, raw: unknown) {
    if (!storage.write || !storage.remove) throw new CheckoutError(503, 'CHECKOUT_UNAVAILABLE', 'Penyimpanan bukti pembayaran belum tersedia.')
    const parsed = inputSchema.safeParse(raw)
    if (!parsed.success || new Set(parsed.data.items.map(i => i.ticketTypeId)).size !== parsed.data.items.length) {
      throw new CheckoutError(400, 'INVALID_CHECKOUT', 'Gunakan pilihan tiket, jumlah, poin dan kupon yang valid.')
    }
    const input: CheckoutInput = { ...parsed.data, purchaseId: parsed.data.purchaseId.toLowerCase(), eventId: parsed.data.eventId.toLowerCase(),
      couponId: parsed.data.couponId?.toLowerCase() ?? null, items: parsed.data.items.map(item => ({ ...item, ticketTypeId: item.ticketTypeId.toLowerCase() })) }
    if (new Set(input.items.map(i => i.ticketTypeId)).size !== input.items.length) throw new CheckoutError(400, 'INVALID_CHECKOUT', 'Pilihan tiket tidak boleh berulang.')
    const items = [...input.items].sort((a, b) => a.ticketTypeId.localeCompare(b.ticketTypeId))
    try {
      await db.$transaction(async tx => {
        let at = new Date()
        // One lock order across checkout, proof, decisions and expiry: Customer -> purchase -> inventory.
        const rewards = await customerRewards(tx, customerId, { now: () => at })
        await tx.$queryRaw`SELECT id FROM temuevent.purchases WHERE id = ${input.purchaseId}::uuid FOR UPDATE`
        const existing = await tx.purchase.findUnique({ where: { id: input.purchaseId }, include: { items: true, rewardRedemption: true } })
        if (existing) {
          const recorded = [...existing.items].sort((a, b) => a.ticketTypeId.localeCompare(b.ticketTypeId))
          if (existing.customerId !== customerId || existing.eventId !== input.eventId || recorded.length !== items.length ||
            existing.subtotal !== BigInt(input.expectedSubtotal) || existing.totalPrice !== BigInt(input.expectedTotal) ||
            recorded.some((item, i) => item.ticketTypeId !== items[i].ticketTypeId || item.quantity !== items[i].quantity) ||
            BigInt(Math.min(input.pointsRequested, rewardInteger(existing.subtotal - existing.voucherDiscount - existing.couponDiscount))) !== existing.pointsUsed ||
            (existing.rewardRedemption?.couponId ?? null) !== (existing.couponDiscount > 0n ? input.couponId ?? null : null)) throw conflict()
          return // Idempotent even after completion/expiry: never reserve or deduct again.
        }
        const events = await tx.$queryRaw<{ status: string; startAt: Date }[]>`
          SELECT e.status::text AS status, e.start_at AS "startAt" FROM temuevent.events e
          JOIN temuevent.users u ON u.id = e.organizer_id AND u.role = 'ORGANIZER'
          WHERE e.id = ${input.eventId}::uuid FOR SHARE OF e`
        const tickets: { id: string; price: bigint; availableSeats: number }[] = []
        for (const item of items) {
          const [ticket] = await tx.$queryRaw<{ id: string; price: bigint; availableSeats: number }[]>`
            SELECT id, price, available_seats AS "availableSeats" FROM temuevent.ticket_types
            WHERE id = ${item.ticketTypeId}::uuid AND event_id = ${input.eventId}::uuid FOR UPDATE`
          if (!ticket || ticket.availableSeats < item.quantity) throw new CheckoutError(409, 'TICKETS_UNAVAILABLE', 'Jumlah tiket yang tersedia berubah. Pilih kembali tiket.')
          tickets.push(ticket)
        }
        const [clock] = await tx.$queryRaw<{ at: Date }[]>`SELECT clock_timestamp() AS at`
        at = clock.at
        if (!events[0] || events[0].status !== 'PUBLISHED' || events[0].startAt <= at) {
          throw new CheckoutError(409, 'EVENT_UNAVAILABLE', 'Event ini tidak lagi menerima pembelian tiket.')
        }
        const subtotal = tickets.reduce((sum, ticket, i) => sum + ticket.price * BigInt(items[i].quantity), 0n)
        if (subtotal > BigInt(Number.MAX_SAFE_INTEGER)) throw new CheckoutError(400, 'CHECKOUT_TOO_LARGE', 'Total pesanan terlalu besar.')
        if (subtotal !== BigInt(input.expectedSubtotal)) throw conflict()
        await rewards.reserveNewPurchase({ ...input, subtotal: rewardInteger(subtotal), voucherDiscount: 0 }, async quote => {
          if (quote.totalPrice !== input.expectedTotal) throw conflict()
          for (const item of items) {
            const changed = await tx.ticketType.updateMany({ where: { id: item.ticketTypeId, eventId: input.eventId, availableSeats: { gte: item.quantity } },
              data: { availableSeats: { decrement: item.quantity } } })
            if (changed.count !== 1) throw conflict()
          }
          await tx.purchase.create({ data: {
            id: input.purchaseId, reference: 'TE-' + input.purchaseId.toUpperCase(), customerId, eventId: input.eventId,
            subtotal: BigInt(quote.subtotal), voucherDiscount: 0n, couponDiscount: BigInt(quote.couponDiscount),
            pointsUsed: BigInt(quote.pointsUsed), totalPrice: BigInt(quote.totalPrice),
            status: quote.totalPrice ? 'WAITING_FOR_PAYMENT' : 'DONE',
            paymentDueAt: quote.totalPrice ? new Date(+at + 2 * 3600000) : null,
            completedAt: quote.totalPrice ? null : at,
          } })
          await tx.purchaseItem.createMany({ data: items.map((item, i) => ({ purchaseId: input.purchaseId,
            eventId: input.eventId, ticketTypeId: item.ticketTypeId, quantity: item.quantity,
            unitPrice: tickets[i].price, lineTotal: tickets[i].price * BigInt(item.quantity) })) })
        })
      }, { timeout: 15000 })
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2002') throw conflict()
      throw error
    }
    return detail(customerId, input.purchaseId)
  }
  async function upload(customerId: string, id: string, bytes: Uint8Array, contentType: string) {
    if (!storage.write || !storage.remove) throw new CheckoutError(503, 'PROOF_UNAVAILABLE', 'Unggahan bukti pembayaran belum tersedia.')
    const before = await detail(customerId, id)
    if (before.proofUploadedAt) return before
    if (before.status !== 'WAITING_FOR_PAYMENT' || !before.paymentDueAt || before.paymentDueAt <= before.serverTime) {
      throw new CheckoutError(409, 'PAYMENT_CLOSED', 'Batas pembayaran sudah berakhir atau pesanan tidak menerima bukti lagi.')
    }
    let normalized: Buffer
    try {
      if (!(bytes instanceof Uint8Array) || bytes.byteLength > MAX_CHECKOUT_PROOF_BYTES) throw new Error('size')
      checkedPaymentProof({ bytes, contentType })
      const image = sharp(bytes, { limitInputPixels: 16_000_000, failOn: 'error', animated: false })
      const metadata = await image.metadata()
      if (!['png', 'jpeg'].includes(metadata.format ?? '') || !metadata.width || !metadata.height) throw new Error('format')
      normalized = await image.rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()
      if (normalized.length > MAX_CHECKOUT_PROOF_BYTES) throw new Error('size')
    } catch { throw new CheckoutError(400, 'INVALID_PROOF', 'Gunakan gambar PNG atau JPEG yang valid, maksimal 3 MB.') }
    const key = `${customerId}/${id}/${randomUUID()}.jpg`
    try {
      await storage.write(key, { bytes: normalized, contentType: 'image/jpeg' })
      await db.$transaction(async tx => {
        await customerRewards(tx, customerId)
        const [row] = await tx.$queryRaw<{ status: string; paymentDueAt: Date | null; key: string | null }[]>`
          SELECT status::text AS status, payment_due_at AS "paymentDueAt", payment_proof_key AS key
          FROM temuevent.purchases WHERE id = ${id}::uuid AND customer_id = ${customerId}::uuid FOR UPDATE`
        if (!row) throw notFound()
        if (row.key) return
        const [{ at }] = await tx.$queryRaw<{ at: Date }[]>`SELECT clock_timestamp() AS at`
        if (row.status !== 'WAITING_FOR_PAYMENT' || !row.paymentDueAt || row.paymentDueAt <= at) {
          throw new CheckoutError(409, 'PAYMENT_CLOSED', 'Batas pembayaran sudah berakhir. Bukti tidak disimpan pada pesanan.')
        }
        await tx.purchase.update({ where: { id }, data: { status: 'WAITING_FOR_ADMIN_CONFIRMATION',
          paymentProofKey: key, proofUploadedAt: at, decisionDueAt: new Date(+at + 3 * 86400000) } })
      }, { timeout: 10000 })
    } catch (error) {
      // A lost SQL response might follow a commit. Never delete an attached proof on uncertainty.
      try {
        const attached = await db.purchase.findFirst({ where: { id, customerId, paymentProofKey: key }, select: { id: true } })
        if (attached) return detail(customerId, id)
        await storage.remove(key)
      } catch { console.warn({ event: 'checkout_proof_cleanup_pending' }) }
      throw error
    }
    const result = await detail(customerId, id)
    // A competing successful upload wins once; remove only this request's unused object.
    const attached = await db.purchase.findFirst({ where: { id, customerId, paymentProofKey: key }, select: { id: true } })
    if (!attached) try { await storage.remove(key) } catch { console.warn({ event: 'checkout_proof_cleanup_pending' }) }
    return result
  }
  return { create, detail, upload,
    async list(customerId: string) {
      const rows = await db.purchase.findMany({ where: { customerId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 20, include: purchaseData })
      const [{ at }] = await db.$queryRaw<{ at: Date }[]>`SELECT clock_timestamp() AS at`
      return rows.map(row => present(row, at))
    },
    async proof(customerId: string, id: string) {
      const row = await db.purchase.findFirst({ where: { id, customerId, proofUploadedAt: { not: null } }, select: { paymentProofKey: true } })
      if (!row?.paymentProofKey) throw notFound()
      const file = await storage.read(row.paymentProofKey)
      if (!file) throw notFound()
      return checkedPaymentProof(file)
    },
  }
}
