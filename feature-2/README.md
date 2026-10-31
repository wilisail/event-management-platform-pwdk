# Feature 2 — account and reward prototype

A separately runnable feature 2 prototype matching Rizky's accepted TemuEvent visual direction. The existing feature 1 application at the repository root is not edited by this module.

Logo and theme values follow [Rizky's feature 1 push](https://github.com/wilisail/event-management-platform-pwdk/commit/cd582753a480d68ce14e00021a52f8ec93d8372f). The [shared UI reference](https://github.com/wilisail/event-management-platform-pwdk/blob/main/docs/ui/README.md) records the original logo, colours, typography and reuse details.

## Run

Requires Node 22.12+ and npm. From the repository root:

```sh
cd feature-2
npm ci
npm run dev
```

- feature 2 UI: http://localhost:3001
- Read-only Express demo API: http://127.0.0.1:4002/health
- Run the existing feature 1 app separately on port 3000 if you want its discovery link to work.
- No database, service account, password, or API key is required for this preview.

The defaults run without an environment file. `.env.example` documents optional overrides. The Express API now loads optional backend settings from `.env`. Database credentials are kept there and excluded from Git.

## What works in this preview

- Customer and organizer **demo persona** selection; this is not authentication.
- Account profile UI, immutable referral-code display/copy, and a local profile-edit confirmation dialog.
- Reward wallet loaded from the Express API, including active/expired point grants and coupons.
- Public organizer profile, with an empty review/rating slot for the feature 1 review module.
- Typed proposed feature 1/feature 2 data shapes in `contracts/types.ts`.
- Referral-grant and calendar-expiry functions with tests; no rewards are actually issued or redeemed.
- Read-only checkout-context response that feature 1 can inspect without changing its current prototype.

The fixtures match feature 1's example of 20,000 points and `WELCOME25`. **The Rp25,000 coupon amount is a demonstration value, not a settled product rule.** Expired samples are shown for empty/error-state work.

## Initial database foundation

The [shared database setup](https://github.com/wilisail/event-management-platform-pwdk/blob/main/docs/shared/database-setup.md) records the active Supabase project, initial schema, applied SQL and connection status. A customer and organizer are seeded; the account/reward screens still use their existing fixtures.

- [Prisma schema](prisma/schema.prisma) and [SQL baseline](../database/prisma/migrations/0_user_foundation/migration.sql).
- `npm run db:generate` generates the typed client; no credentials are needed.
- `npm run db:validate` validates the schema.
- `npm run db:check` reads the seeded customer when `DATABASE_URL` is configured and reachable.
- `npm run db:seed` inserts missing development identities without changing existing ones.
- The optional `/api/demo/database-check` diagnostic requires `F2_DATABASE_CHECK_ENABLED=true` and is disabled by the entry point in production.

Managed SQL access and the seeded rows are verified. Live Express → Prisma → Supabase connectivity passed on 19 October 2026; shared event/purchase verification passed on 28 October. On 31 October, the account/session database foundation was applied and tested through the existing backend role. See [account/session foundation](../docs/shared/account-session-foundation.md) for the models, relationship tests and remaining HTTP authentication work. The API returns a sanitized 503 when its optional database diagnostic is unavailable. Shared migrations have one recorded history under ../database/prisma/migrations.

## Validation

```sh
npm run typecheck
npm test
npm run build
```

Next.js type errors are not suppressed. The tests cover expiry boundaries, leap/month-end dates, user-data isolation, role restrictions in demo routes, CORS, and the checkout data shape.

## What remains before a graded submission

Registration/login, password hashing and sessions, backend authorization, reward/purchase persistence, atomic referral issuance, avatar uploads, password change/reset emails, organizer management/statistics/attendee APIs, and purchase decisions remain to be implemented. The user table, shared event/purchase starter, account/session tables and development seed are implemented. The session tables prepare real sign-in; registration/login endpoints, cookie/JWT handling and backend permission middleware are still pending. PRD-required SQL transactions will be needed for real multi-record writes.

The `x-demo-persona` header is deliberately only a demo selector. Production identity must come from the agreed authenticated session, never from a caller-supplied user ID or role.

Shared UX working defaults, alternatives and their effect on both features are recorded in the [canonical UX reference](https://github.com/wilisail/event-management-platform-pwdk/blob/main/docs/shared/ux-reference.md). Defaults remain open to changes following input.

## Ownership

- feature 1 author: Rizky; event discovery/creation, purchasing/vouchers, reviews.
- feature 2 author: Wili; accounts/rewards/profiles/dashboard. This initial feature 2 implementation is agent-assisted.
- Theme and product name: adopted from Rizky's feature 1 prototype, commit `cd582753a480d68ce14e00021a52f8ec93d8372f`.
- This folder contains feature 2's own frontend, demo backend, contracts, tests, and run instructions. Reusing the theme does not transfer feature 1 authorship.
