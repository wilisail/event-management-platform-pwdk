import type { PrismaClient } from '../../generated/prisma/client'
import type { AttendanceView } from '../../contracts/types'

type AttendanceRecord = Omit<AttendanceView, 'attendedAt'> & { attendedAt: Date }

/** Feature 1 calls this on its backend with the customer ID from its verified session. */
export async function hasAttendedEvent(db: Pick<PrismaClient, 'attendance'>, eventId: string, customerId: string) {
  return Boolean(await db.attendance.findFirst({ where: { eventId, customerId, eventPurchase: { status: 'DONE' } },
    select: { id: true } }))
}

export function prismaMarkAttendance(db: Pick<PrismaClient, '$queryRaw'>) {
  return async (organizerId: string, eventId: string, customerId: string, transactionId: string): Promise<AttendanceView | null> => {
    // Check ownership and registration while holding shared locks against changes to the source rows.
    const [inserted] = await db.$queryRaw<AttendanceRecord[]>`
      WITH eligible AS (
        SELECT p.event_id, p.customer_id, p.id FROM temuevent.purchases p
        JOIN temuevent.events e ON e.id = p.event_id
        WHERE e.organizer_id = ${organizerId}::uuid AND p.event_id = ${eventId}::uuid
          AND p.customer_id = ${customerId}::uuid AND p.id = ${transactionId}::uuid AND p.status = 'DONE'
        FOR SHARE OF p, e
      )
      INSERT INTO temuevent.attendance (event_id, customer_id, transaction_id, marked_by_organizer_id)
      SELECT event_id, customer_id, id, ${organizerId}::uuid FROM eligible
      ON CONFLICT (event_id, customer_id) DO NOTHING
      RETURNING event_id AS "eventId", customer_id AS "customerId", transaction_id AS "transactionId", attended_at AS "attendedAt"`
    if (inserted) return { ...inserted, attendedAt: inserted.attendedAt.toISOString() }

    // A concurrent insert can win after the first statement's snapshot. Read again and reapply the guards.
    const [existing] = await db.$queryRaw<AttendanceRecord[]>`
      SELECT a.event_id AS "eventId", a.customer_id AS "customerId", a.transaction_id AS "transactionId", a.attended_at AS "attendedAt"
      FROM temuevent.attendance a
      JOIN temuevent.events e ON e.id = a.event_id
      JOIN temuevent.purchases p ON p.event_id = a.event_id AND p.customer_id = a.customer_id
      WHERE e.organizer_id = ${organizerId}::uuid AND a.event_id = ${eventId}::uuid
        AND a.customer_id = ${customerId}::uuid AND p.id = ${transactionId}::uuid AND p.status = 'DONE'`
    return existing ? { ...existing, attendedAt: existing.attendedAt.toISOString() } : null
  }
}
