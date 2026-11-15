import type { PrismaClient } from '../../generated/prisma/client'
import type { EventReviewEligibility, EventReviewView, OrganizerView } from '../../contracts/types'

/** Confirmed customers may review; attendance is optional self-reported context. */
export function prismaEventReviewRepository(db: Pick<PrismaClient, '$queryRaw'>) {
  async function eligibility(eventId: string, customerId: string): Promise<EventReviewEligibility | null> {
    const [row] = await db.$queryRaw<{ purchased: boolean; reviewed: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM temuevent.purchases p WHERE p.event_id = e.id
          AND p.customer_id = ${customerId}::uuid AND p.status = 'DONE'
      ) AS purchased, EXISTS (
        SELECT 1 FROM temuevent.reviews r WHERE r.event_id = e.id AND r.user_id = ${customerId}::uuid
      ) AS reviewed
      FROM temuevent.events e WHERE e.id = ${eventId}::uuid AND e.status = 'PUBLISHED'`
    if (!row) return null
    const reason = row.reviewed ? 'ALREADY_REVIEWED' : !row.purchased ? 'PURCHASE_REQUIRED' : 'ELIGIBLE'
    return { eligible: reason === 'ELIGIBLE', reason }
  }

  return {
    eligibility,
    async create(input: { eventId: string; userId: string; rating: number; comment?: string; reportedAttendance?: boolean }): Promise<EventReviewView> {
      // Recheck inside the insert, so an earlier eligibility response cannot authorize a stale write.
      // Source event/purchase rows are locked; the checkbox does not grant eligibility.
      const [row] = await db.$queryRaw<(Omit<EventReviewView, 'createdAt'> & { createdAt: Date })[]>`
        WITH eligible AS (
          SELECT e.id FROM temuevent.events e
          JOIN temuevent.purchases p ON p.event_id = e.id AND p.customer_id = ${input.userId}::uuid
          JOIN temuevent.users u ON u.id = p.customer_id AND u.role = 'CUSTOMER'
          WHERE e.id = ${input.eventId}::uuid AND e.status = 'PUBLISHED' AND p.status = 'DONE'
          FOR SHARE OF e, p
        ), inserted AS (
          INSERT INTO temuevent.reviews (event_id, user_id, rating, comment, reported_attendance)
          SELECT id, ${input.userId}::uuid, ${input.rating}::integer, ${input.comment?.trim() || null}::text,
            ${input.reportedAttendance ?? null}::boolean FROM eligible
          ON CONFLICT (event_id, user_id) DO NOTHING
          RETURNING id, event_id, user_id, rating, comment, reported_attendance, created_at
        )
        SELECT r.id, r.event_id AS "eventId", r.user_id AS "userId", u.name AS "reviewerName",
          r.rating, r.comment, r.reported_attendance AS "reportedAttendance", r.created_at AS "createdAt"
        FROM inserted r JOIN temuevent.users u ON u.id = r.user_id`
      if (row) return { ...row, createdAt: row.createdAt.toISOString() }
      const state = await eligibility(input.eventId, input.userId)
      throw new Error(!state ? 'EVENT_NOT_FOUND' : state.reason === 'ALREADY_REVIEWED'
        ? 'REVIEW_ALREADY_EXISTS' : state.reason === 'ELIGIBLE' ? 'REVIEW_CONFLICT' : state.reason)
    },
    async organizerRating(organizerId: string): Promise<OrganizerView['ratingSummary']> {
      const [row] = await db.$queryRaw<{ average: number; count: number }[]>`
        SELECT coalesce(avg(r.rating), 0)::float8 AS average, count(r.id)::integer AS count
        FROM temuevent.users u
        LEFT JOIN temuevent.events e ON e.organizer_id = u.id AND e.status = 'PUBLISHED'
        LEFT JOIN temuevent.reviews r ON r.event_id = e.id
        WHERE u.id = ${organizerId}::uuid AND u.role = 'ORGANIZER'
        GROUP BY u.id`
      return row ?? null
    },
  }
}
