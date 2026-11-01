# Shared database starter

Updated: 1 November 2026. Live starter for both feature builders; field changes remain open to discussion.

## Referral/reward storage

Five reward models and their owner/expiry/duplicate-use constraints are applied: `Referral`, `PointGrant`, `RewardCoupon`, `RewardRedemption`, `PointAllocation`. The [companion note](../docs/shared/referral-reward-schema-reference.md) explains the relationships and remaining services. The shared model is mirrored in feature 2's Prisma schema; regenerate your client after adopting it.

Migration `20261031212002_referral_rewards` adds those tables plus a purchase/customer unique key, enables RLS and grants only the required operations to the existing backend role. The original sample users, events, tickets and 30 purchases are preserved. No database reset or credential change is required. Reward tables start empty; sample purchase discounts do not imply a persisted real reward ledger.

Live ownership/constraint/permission checks passed through Prisma with all fixtures rolled back. On the `feature-2` branch, `cd feature-2` then `npm run db:verify:rewards-schema` reruns the check using the ignored backend environment. This development verifier is not signup or checkout business logic. Incoming-referral issuance, wallet and shared reservation/restoration services follow separately.

## Tables

| Prisma model | PostgreSQL table | Purpose |
| --- | --- | --- |
| User | temuevent.users | Existing customer/organizer identities; UUID IDs |
| AuthSession | temuevent.auth_sessions | One sign-in; user link, expiry and revocation |
| PasswordResetToken | temuevent.password_reset_tokens | Private recovery delivery request, digest, expiry and one-use status; F2-owned |
| AuthRefreshToken | temuevent.auth_refresh_tokens | Refresh-secret hashes and consumption history per session |
| Event | temuevent.events | Event fields from Rizky's current form |
| TicketType | temuevent.ticket_types | Regular/Workshop/free categories, prices and inventory |
| Purchase | temuevent.purchases | One event per purchase; customer, totals and six PRD statuses |
| PurchaseItem | temuevent.purchase_items | Ticket quantities and historical prices within a purchase |
| Referral | temuevent.referrals | One incoming referral per newcomer |
| PointGrant | temuevent.point_grants | Referrer's separate point awards and original expiry |
| RewardCoupon | temuevent.reward_coupons | Newcomer's platform coupon and original expiry |
| RewardRedemption | temuevent.reward_redemptions | Owner-bound purchase claim and reward state |
| PointAllocation | temuevent.point_allocations | Exact earning batch and amount used by a claim |

TicketType is a ticket category, not a numbered seat or issued QR ticket. Event availability is the sum of its ticket types' availableSeats. Free events use a zero-price ticket type.

Purchase is the transaction entity in the shared UX/API notes. Its id maps to transactionId in feature 2's proposed dashboard routes.

## Connect from feature 1

Rizky continues building his own frontend/backend on feature-1. The shared package can be copied into that branch without changing his UI:

```bash
git fetch origin main
git restore --source=origin/main -- database
cd database
npm ci
npm run db:generate
# Put the supplied .env in this directory.
npm run db:check
```

Keep this standalone package out of the frontend TypeScript compilation: add `"database"` to the frontend tsconfig.json `exclude` array while preserving the builder's other settings. This is already configured on main. Feature 1's own backend can keep its separate TypeScript configuration.

The supplied backend password and certificate remain valid for this package; no new database account or Supabase project is needed. The included certs directory contains the public CA. The actual .env and credential ZIP stay outside Git. The example env has placeholders only.

The check loads the supplied .env, then starts Node with the included CA trusted before TLS initializes. No extra certificate setting is needed for this package's check. When wiring the app's own backend, preserve the TLS settings described in the shared setup note.

Use prisma/schema.prisma as the shared model reference when wiring feature 1's own Prisma client. src/client.ts and scripts/check.ts show a working PostgreSQL adapter and joined query. Keep the generator output/import paths appropriate for the app. SQL tables are in temuevent, not public.

## Mapping the current feature 1 prototype

| Current UI fixture | Database projection |
| --- | --- |
| Numeric event ID | UUID string; keep it as a string in API routes |
| title | Event.name |
| date / dateLabel / time | Format startAt and endAt for Asia/Jakarta |
| image | Event.imageUrl |
| organizer text | Event.organizer.name |
| price | Lowest ticket-type price; zero represents free registration |
| seats | Sum ticketTypes.availableSeats |

These are data mappings; Rizky retains the UI and endpoint implementation. The connection example selects safe organizer fields instead of returning a full User record.

## Sample data

Development seed: three events, four ticket types and thirty purchases, five in each required status. A zero-payment DONE purchase is included. Purchases reference the existing organizer/customer and contain item rows. Active/confirmed purchases reserve inventory; rejected/expired/canceled samples release it.

seeds/demo.sql inserts missing demo records only and reserves inventory only for newly inserted purchases. Re-running does not replace existing events or double-reserve seats. Demo payment proof keys start with DEMO_ONLY_NO_FILE; no real proof files are attached. These users still have no working login.

## Account/session foundation

The two auth tables are applied and verified. [Account/session notes](../docs/shared/account-session-foundation.md) explain their relationships and full-stack use. The seeded identities still have no passwords; HTTP registration/login and cookies/JWTs are the next batch.

`npm run db:verify:auth` verifies session/token relationships, one-time conditional consumption, revocation/expiry query behavior, database constraints and backend-role limits. Its writes are rolled back.

## Shared migrations

database/prisma/migrations is the shared ordered migration history. The original 0_user_foundation file is copied byte-for-byte and was already applied. The event/purchase and account/session migrations are additive. It was applied through Supabase SQL, then registered as applied in Prisma's history using the matching SQL checksum. The original baseline record was preserved. There is no reset of the shared database.

The application DATABASE_URL provides table operations, not schema ownership. Wili coordinates schema migration execution using a separate authorized connection. New changes can be supplied as draft Prisma models/SQL in feature-1; the starter is available immediately while those changes are discussed.

db:deploy and db:status are migration-maintainer commands. Use an authorized DIRECT_URL for them; do not use the runtime account to reset, push or recreate the shared schema. Native Prisma CLI TLS options differ from the Node adapter; see the shared database setup note.

## Implementation boundary

This supplies persistent tables, client mappings and fixtures. Feature 1 still implements event APIs, search, uploads, checkout, promotions, transition rules and reviews. Feature 2 implements authentication, rewards and organizer dashboard behavior.

RLS permits only the backend role; the Express backend must enforce customer/organizer ownership. Data API roles have no access. This is not Supabase Auth or an end-user authorization implementation.

Database constraints check dates, nonnegative amounts, totals, quantities, capacity and same-event items. Purchase endpoints must still reserve inventory and rewards atomically, enforce deadlines and restore resources once. Scheduled expiry, rewards, vouchers, emails and attendance are not implemented by this starter.

## Verification

Passed on 28 October 2026 in a cloud VM using the existing backend application credentials: Prisma validation/client generation, live joined reads and temporary transactional writes. Thirty demo purchases are present. Runtime schema-creation permissions were not expanded.

db:verify performs temporary writes inside transactions that are rolled back, checks related records and a cross-event foreign-key failure, and confirms all thirty demo purchases. It leaves no test records. Run only against the development database.

See [shared setup](../docs/shared/database-setup.md) and [technical reference](../docs/shared/technical-reference.md).

Account/session verification passed on 31 October 2026: both schema clients validate/generate, the new script passes TypeScript and live constraint/relationship checks, and the original purchase/inventory checks still pass. Auth test records are rolled back.


## Password recovery queue (Day 3 part 3)

`20261101091039_password_reset_queue` is applied to Supabase, with RLS and backend-only access. The F2 implementation stores only reset digests and handles activation/delivery/redeem under the existing account authority; see the [companion](../docs/shared/password-reset-reference.md). F1 need not configure another email provider for recovery.

Supabase migration history records this application. Before a future Prisma deploy, an owner/migration-role `DIRECT_URL` targeting `schema=temuevent` must run `prisma migrate resolve --applied 20261101091039_password_reset_queue` to reconcile Prisma's separate ledger. The runtime account is intentionally not a migration administrator. Do not rerun the CREATE TABLE SQL or reset the shared database. No direct ledger insert was made.
