# Day 5 Part 2 — Manual attendance and review eligibility

Updated 4 November 2026. Feature 2's attendee list and manual check-in are built in the local checkout. The table still lists confirmed purchases, including free registrations. The organizer can select **Tandai hadir**, confirm, and see the time recorded in WIB. Multiple purchases for the same customer/event show the same attendance status.

| Layer | What it does |
| --- | --- |
| React | Shows name, quantity, total paid, purchase reference and attendance. Confirms a mark and refreshes from the server if the write result is uncertain. |
| Express | `POST /api/organizer/events/:eventId/attendance` accepts only `customerId` and `transactionId`. The organizer ID comes from the session. Role and session-bound CSRF are required. A foreign, mismatched or unconfirmed purchase returns 404. |
| PostgreSQL | Checks event ownership and the matching `DONE` purchase as part of the insert. Composite foreign keys anchor both the event and customer to that purchase. The `(event_id, customer_id)` uniqueness rule keeps repeat marking idempotent. The first record and timestamp are retained. The backend role has read/insert privileges only. |

## Feature 1 handoff

Use `hasAttendedEvent(db, eventId, customerId)` on the server, or the equivalent lookup through the shared database. Supply the customer ID from the verified session. The check requires an attendance row and its linked purchase to remain `DONE`. F1 still owns accepting, rejecting and deduplicating review submissions. No public lookup by arbitrary customer ID was introduced.

```sql
SELECT EXISTS (
  SELECT 1 FROM temuevent.attendance a
  JOIN temuevent.purchases p ON p.id = a.transaction_id
  WHERE a.event_id = $1::uuid AND a.customer_id = $2::uuid AND p.status = 'DONE'
) AS attended;
```

**Verification.** TypeScript and a clean production build passed. The disposable PostgreSQL verifier replayed all eight migrations and checked the real HTTP/API and Prisma paths under the restricted backend role. It covered wrong role, wrong organizer, mismatched customer, bad CSRF, a pending purchase, successful check-in through a free purchase, repeat marking through another purchase, attendee reload, and the review lookup before and after marking. The database rejected a direct insert linking attendance to the wrong customer.

**Beyond local build.** Apply `20261104105114_event_attendance` to the intended non-production database with the authorized migration role before deploying this attendee-list code. Day 5.4 covers browser confirmation and mobile layout. Day 6–7 covers real F1 checkout, marking in the combined Preview, and F1 refusing a review before attendance and allowing an eligible submission afterwards. No new hosted provider or credential is required for this feature. Shared Supabase and Vercel were not changed in this checkpoint.

**Learning checkpoint.** A `DONE` purchase proves the customer registered. Attendance is a separate fact recorded by the organizer. The ownership check keeps one organizer from marking another event's customers, and the database uniqueness rule keeps repeat clicks from creating a second attendance record.

Implementation: `feature-2/server/organizer/attendance.ts`, `feature-2/server/protected-http.ts` and `feature-2/components/organizer-dashboard.tsx`. See the [work schedule](feature-2-completion-plan.md).
