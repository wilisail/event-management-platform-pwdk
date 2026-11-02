# Review schema integration

Updated: 2 November 2026. Shared database coordination; no Day 4/5 business flow is marked complete by this change.

## Result and ownership

Rizky added `Review` plus inverse `User.reviews` / `Event.reviews` in `feature-1/prisma/schema.prisma` at commit `51a7264b483154b812925f80473d8ee01e56d9e1`. Those additions are merged into `database/prisma/schema.prisma` and `feature-2/prisma/schema.prisma`, preserving the newer account, reset and reward models. His branch is not overwritten. The extra author index supports the user foreign key.

The migration creates `temuevent.reviews` in the existing Supabase PostgreSQL database. There is no new database/project, account or credential. The existing users/events/purchases remain the authority.

| Item | Applied storage contract |
| --- | --- |
| Identity | Database-generated UUID `id` |
| Event link | UUID `event_id` → `temuevent.events.id`; restrict deletion |
| Author link | UUID `user_id` → `temuevent.users.id`; restrict deletion |
| Rating | Required integer, database check from 1 through 5 |
| Comment | Nullable text, preserving F1's model; F1 retains its request validation rules |
| Timestamp | `created_at`, TIMESTAMPTZ(3), default current time |
| Duplicate protection | Unique (`event_id`, `user_id`) |
| Indexes | F1's event index plus a user foreign-key index |
| Access | RLS enabled; `temuevent_app` SELECT/INSERT with backend policies; no Data API role grants |

Review editing/deletion is not enabled by this storage checkpoint. If F1 later needs those operations, coordinate the endpoint behavior and minimum grants explicitly.

## Remaining application work

- **F1 / Rizky:** review request validation, deriving `userId` from the verified session, checking actual attendance, inserting/querying reviews, rating aggregates and connecting the review page. His inspected page still uses sample reviews/client state. His route and payload design remain with F1.
- **F2 / Wili:** organizer-authorized attendance marking and the shared eligibility lookup, then public organizer rating integration using F1's aggregates. A confirmed/DONE purchase establishes registration, not actual attendance.
- **Together:** agree the attendance lookup and response, then verify attended/non-attended customers, another account's ID, repeated submissions and simultaneous duplicate submissions.

No public review API or attendance table/service is introduced in this schema-only integration. The database foreign keys and rating/duplicate constraints cannot determine that a person attended; the backend must enforce that rule using the attendance record.

## Adopt the shared mapping

The canonical shared mapping belongs at `database/prisma/schema.prisma` on `main` / `integration` once this change is merged. During draft review, use the updated files on `review-schema-20261102`; the protected branches have not received this change. F1 can retain its own generator output/configuration and bring in the shared models or the reviewed Review/inverse additions. The existing backend environment remains valid.

From the shared database package:

```sh
cd database
npm ci
npm run db:validate
npm run db:generate
npm run db:verify:reviews
```

The final command requires the existing private backend `DATABASE_URL`, trusted CA and network access to the pooler. It does not require owner credentials and rolls back every fixture. The companion SQL script can also run through the authorized owner SQL Editor; it reports `runtime_role_exercised=false` there because owner mode verifies grants/policy metadata rather than impersonating the runtime account.

## Migration record and supported reconciliation

- Ordered file: `database/prisma/migrations/20261102094521_event_reviews/migration.sql`; its timestamp was generated with `supabase migration new event_reviews`.
- SHA-256: `5a0d3ea5ca4f9c0b1364e35fd8bc394574b1a649edc3f5f84451c4bb38f2c01b`.
- Applied through Supabase's supported migration tool; its server history version is `20261102095152`, name `event_reviews`.
- The already-applied reset migration file is preserved byte-for-byte with SHA-256 `999f60a33bf27c4f9a560dbb4645df03a1ce3bc18d736a48f20be9130445c646`.

Prisma's separate ledger still has the original four rows. A direct ledger insert was previously blocked by automatic approval review because it bypassed Prisma. This integration does not repeat that operation or widen runtime privileges. Use Prisma's supported commands with an authorized owner/migration `DIRECT_URL` before any later Prisma deployment:

```sh
npx prisma migrate resolve --applied 20261101091039_password_reset_queue
npx prisma migrate resolve --applied 20261102094521_event_reviews
npx prisma migrate status
```

Run those from `database` only after checking the applied definitions and matching file checksums. Both tables already exist; do not rerun their CREATE TABLE migrations or use a reset / db push to reconcile them. The supplied runtime connection is deliberately insufficient for migration administration. No owner connection is prepared in this checkpoint.

## Verification and practical limits

| Check | Evidence |
| --- | --- |
| Schema/type mapping | Shared and F2 schemas validate and generate clients with Prisma 7.10.1; new verification script passes TypeScript checking |
| Existing application | F2 TypeScript, all 138 tests and clean production build pass |
| Fresh SQL replay | All six repository migrations replay on isolated PGlite PostgreSQL; the review SQL test runs as `temuevent_app` and preserves before/after counts |
| Live Supabase | `REVIEW_SCHEMA_DB_OK` through the authorized owner SQL connection: default UUIDs, user/event joins, nullable comment, rating boundaries, duplicate rejection, foreign keys, backend grants and RLS metadata; all fixtures roll back |
| Live runtime/Prisma | Not completed from this workspace: Supabase pooler DNS returned `EAI_AGAIN`. The SQL Editor cannot SET ROLE to the runtime role; no role membership was changed to get around that restriction. Rerun `db:verify:reviews` from the builder's configured host |
| Existing data | Five existing users, three events, four ticket types, thirty purchases and thirty items remain; before/after row fingerprints match. Zero reviews and zero review-test identities remain |
| Security advisor | No warning/error finding. Existing migration-history table has intentional RLS without public policies; [advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) |
| Performance advisor | Informational unused indexes only on this development dataset; [advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index). Indexes are retained for their intended queries |

The table is empty after verification. No account is deleted, no test review is committed, and the schema change does not complete F1's business flow or F2's attendance work.
