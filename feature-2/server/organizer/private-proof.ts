import type { PrismaClient } from '../../generated/prisma/client'

export const MAX_PAYMENT_PROOF_BYTES = 5 * 1024 * 1024

export interface StoredPaymentProof { bytes: Uint8Array; contentType: string }
/** Backend-only port. Never return a storage key or public/signed URL to the browser. */
export type OrganizerProofReader = (organizerId: string, transactionId: string) => Promise<StoredPaymentProof | null>
export interface PaymentProofStorage { read(key: string): Promise<StoredPaymentProof | null> }

export function prismaOrganizerProofReader(db: Pick<PrismaClient, 'purchase'>, storage: PaymentProofStorage): OrganizerProofReader {
  return async (organizerId, transactionId) => {
    // Repeat ownership at the file boundary; a preceding detail request is not authority.
    const purchase = await db.purchase.findFirst({ where: {
      id: transactionId, event: { organizerId }, proofUploadedAt: { not: null }, paymentProofKey: { not: null },
    }, select: { paymentProofKey: true } })
    return purchase?.paymentProofKey ? storage.read(purchase.paymentProofKey) : null
  }
}

export function checkedPaymentProof(file: StoredPaymentProof) {
  if (!(file.bytes instanceof Uint8Array) || !file.bytes.byteLength || file.bytes.byteLength > MAX_PAYMENT_PROOF_BYTES) {
    throw new Error('Invalid proof file')
  }
  const bytes = Buffer.from(file.bytes)
  const type = file.contentType.split(';', 1)[0].trim().toLowerCase()
  const png = type === 'image/png' && bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const jpeg = type === 'image/jpeg' && bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  if (!png && !jpeg) throw new Error('Invalid proof file')
  return { bytes, contentType: png ? 'image/png' : 'image/jpeg', filename: png ? 'bukti-pembayaran.png' : 'bukti-pembayaran.jpg' }
}
