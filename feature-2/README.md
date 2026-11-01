# Feature 2 — accounts, authentication and organizer pages

A separately runnable feature 2 application with connected registration/login, protected account and organizer pages, plus a separate account/reward fixture preview. It follows Rizky's accepted TemuEvent visual direction. The existing feature 1 application at the repository root is not edited by this module.

Logo and theme values follow [Rizky's feature 1 push](https://github.com/wilisail/event-management-platform-pwdk/commit/cd582753a480d68ce14e00021a52f8ec93d8372f). The [shared UI reference](https://github.com/wilisail/event-management-platform-pwdk/blob/main/docs/ui/README.md) records the original logo, colours, typography and reuse details.

## Run

Requires Node 22.12+ and npm. From the repository root:

```sh
cd feature-2
npm ci
npm run dev
```

- feature 2 UI: http://localhost:3001 redirects to the protected account page; `/register`, `/login` and `/organizer` are real account/session screens.
- Fixture UI: http://localhost:3001/preview works without database credentials and is labelled as sample data.
- Express API: http://127.0.0.1:4002/health. Demo routes remain read-only; registration writes with DATABASE_URL, and login/sessions also require AUTH_JWT_SECRET.
- Run the existing feature 1 app separately on port 3000 if you want its discovery link to work.
- Real authentication requires the private backend DATABASE_URL and AUTH_JWT_SECRET. The browser does not receive these values.

The fixture preview runs without an environment file; real account pages show a controlled service error until backend authentication is configured. `.env.example` documents settings. The Express API loads backend settings from the ignored `.env`. Relative browser `/api` requests are rewritten to `F2_API_ORIGIN` (the older F2_DEMO_API_ORIGIN remains a fallback), defaulting to http://127.0.0.1:4002. Configure the exact allowed browser origin for deployment and use HTTPS; cookies are Secure in production.

## Database-backed registration

`POST /api/auth/register` validates JSON, normalizes email, hashes passwords with Node scrypt and generates the new account's immutable referral code. The `/register` form accepts an optional inviter code. A valid referral atomically creates the account/referral, credits the inviter 10,000 points and issues the newcomer a three-month coupon. Unknown codes return 400; duplicate email returns 409 without another award. The safe response remains data.user, with separate login and no session cookie.

See the [referral signup companion note](../docs/shared/referral-registration-reference.md) for transaction boundaries, rollback/retries and reward ownership. `REFERRAL_COUPON_IDR` defaults to the prototype's Rp25,000 for future issuance; the PRD leaves the amount unspecified. Existing coupon values remain unchanged. `npm run db:verify:referrals` checks real HTTP/database behavior, injected failure rollback and coupon collision retries; all fixtures roll back.

The existing private DATABASE_URL enables the route; without it, registration returns 503 and the fixture preview remains available. The backend trusts the included public Supabase CA by default. See [registration reference](../docs/shared/registration-reference.md) for inputs, status codes, layering and learning notes.

`npm run db:verify:registration` starts a real HTTP server, writes/reads accounts through Prisma against Supabase, verifies hashes and duplicate handling, then rolls back test accounts. TypeScript, unit/API tests, live verification and a clean npm ci passed on 31 October 2026.

## Login and sessions

The backend implements `/api/auth/login`, `/refresh`, `/logout`, `/csrf` and `/session`. Password login creates a database session; HttpOnly cookies carry signed access and random refresh credentials. Refresh rotates once and detects reuse; logout revokes the session. Working defaults: fifteen-minute access and a seven-day absolute session.

Add the private `AUTH_JWT_SECRET` from the backend handoff alongside DATABASE_URL in the ignored `.env`. Without that key, session routes return 503 while registration and the fixture preview remain available. See [login/session mechanics, request headers and CSRF contract](../docs/shared/login-session-reference.md). Connected forms, account navigation, guarded pages and refresh/logout coordination are explained in the [frontend companion note](../docs/shared/frontend-authentication-reference.md).

`npm run db:verify:sessions` exercises the real HTTP/database flow and rolls back temporary accounts/sessions/tokens. TypeScript, 57 unit/API tests, live verification, the actual backend bootstrap and a clean install/client generation passed on 31 October. No migration or permission change was needed.

## Protected identity and organizer reads

`GET /api/me` uses the real authenticated identity. Organizer-only `/api/organizer/events` and `/api/organizer/events/:eventId/attendees` read only the caller's owned events and confirmed purchase rows. Reusable authentication/role/CSRF guards are available for future protected operations. The attendee projection is registration data, not check-in proof.

See the [authorization companion note](../docs/shared/authorization-reference.md) for middleware order, ownership filters, 401/403/404 behavior, pagination and the effect on both features. TypeScript, all 66 unit/API tests and real HTTP/database authorization verification passed. `npm run db:verify:authorization` checks the flow with a customer and two organizers and rolls back its temporary data. No new dependency, schema, grant or secret is required.

## Authenticated wallet and referral reads

For the real account, customer-only `GET /api/me/rewards` returns all-row available points, available coupon count, and paginated grant/coupon history. `GET /api/me/referral` returns the signed-in account's code and referral count for either role. The `/account` tabs use these authenticated reads, with server-time expiry, claim status, refresh/error/empty states and the original theme. See the [wallet companion note](../docs/shared/wallet-reference.md) for request shapes, read snapshots and learning mechanics. `npm run db:verify:wallet` exercises real signup/login/reward reads and rolls back all QA accounts, sessions, rewards and purchases.

## Own profile and pictures — Day 3 part 1

The real account page now saves the current account's name and connects a confirmed photo selection to the protected upload route. The backend bounds input size/type/pixels, decodes and re-encodes still WebP, strips metadata and updates the existing profile key under a user-row lock. Current login/refresh/identity reads project the saved name/photo. Real public organizer pages show safe organizer identity/photo; the review aggregate remains Feature 1 integration work. The old organizer fixture moved to `/preview/organizers/demo-organizer-001`.

**Hosted photo storage is pending configuration and live verification.** The existing handoff has no Storage secret and the project initially had no bucket. Name editing works with the existing configuration; uploads fail with controlled 503 until the private backend `SUPABASE_URL` / `SUPABASE_SECRET_KEY` settings are supplied and `npm run storage:setup` creates/verifies the private bucket. See the [companion note](../docs/shared/profile-upload-reference.md) for setup, contracts, failure cleanup and the Day 3–6 dependency map.

TypeScript, 111 application tests and the production build pass. Real Supabase profile/session/metadata checks reported `PROFILE_DB_OK` with fully rolled-back fixtures and original user fingerprints. That verifier uses an explicit in-memory image transport; it does not validate hosted Storage. Desktop/phone browser checks passed using a separate disposable memory backend: confirmation/cancel/save, reloads, invalid-file feedback, anonymous organizer view and no horizontal overflow. Feature 2 is patched to Next.js 16.4.3, and its production dependency audit reports zero known vulnerabilities at this checkpoint.

## What works in the fixture preview

The original fixture application is now at `/preview`. The real `/account` page uses `/api/me` and does not show the example points/coupons as actual rewards. Real wallet/referral reads and own-name edits are implemented; hosted picture verification and production purchase/reward adapter wiring remain pending; the internal reward core is implemented.

- Customer and organizer **demo persona** selection; this is not authentication.
- Account profile UI, immutable referral-code display/copy, and a local profile-edit confirmation dialog.
- Reward wallet loaded from the Express API, including active/expired point grants and coupons.
- Public organizer profile, with an empty review/rating slot for the feature 1 review module.
- Typed proposed feature 1/feature 2 data shapes in `contracts/types.ts`.
- Referral-grant and calendar-expiry functions with tests; no rewards are actually issued or redeemed.
- Read-only checkout-context response that feature 1 can inspect without changing its current prototype.

The fixtures match feature 1's example of 20,000 points and `WELCOME25`. Rp25,000 is also the configurable initial signup coupon default, open to input; it is not a PRD-prescribed amount. Expired samples remain available for empty/error-state work.

## Initial database foundation

The [shared database setup](https://github.com/wilisail/event-management-platform-pwdk/blob/main/docs/shared/database-setup.md) records the active Supabase project, initial schema, applied SQL and connection status. A customer and organizer are seeded with no password credentials. Register a new account for real login; a new organizer has no owned events until linked event data is created. Only `/preview` and demo APIs use the old account/reward fixtures.

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

Next.js type errors are not suppressed. All 96 tests, TypeScript and a production build passed at the 1 November reward-operation checkpoint. The tests cover reward/date boundaries, authentication/session rules, real permission middleware, ownership/pagination, CSRF and the new client refresh/error/return-path behavior. The real HTTPS client → Next rewrite → Express → Prisma → Supabase path passed with rolled-back QA data; login/signup pages were visually inspected. Password-form submission and multiple-tab UI behavior remain manual release checks.

`scripts/serve-browser-check.ts` is an explicitly enabled loopback QA server that places temporary accounts/events/purchases/sessions in one rollback transaction. `scripts/verify-frontend-client.ts` tests the real client against that server via an HTTPS preview, with disposable credentials supplied through process environment settings. These QA runners are not the normal application entry point or public control endpoints; never run the verifier against the ordinary persistent server. The normal development command remains `npm run dev`.

## What remains before a graded submission

The [internal reward core](../docs/shared/reward-operations-reference.md) is implemented at `server/rewards/operations.ts`. Call `customerRewards(tx, verifiedCustomerId)` inside the caller's SQL transaction, before purchase/inventory locks; it exposes quote, new/existing purchase reservation, consumption and restoration. Feature 1's purchase/items/seats/voucher callbacks and the organizer/expiry adapters still need production wiring. No public write route or duplicate checkout implementation is added here.

`npm run db:verify:reward-operations` checks the real Supabase role with fully rolled-back fixtures. `npm run db:verify:reward-races` requires an explicitly enabled, separately provisioned loopback PostgreSQL database named `temuevent_reward_test`; it never uses the shared DATABASE_URL. The companion records the six independent-session races and the original migration/policy setup. Run verification/build commands sequentially because their Prisma-generation hooks write the same generated directory.

The referral/reward database foundation and atomic signup issuance are applied and verified. See the [schema companion note](../docs/shared/referral-reward-schema-reference.md). `npm run db:verify:rewards-schema` checks constraints/permissions, while `npm run db:verify:referrals` checks signup and rollback. Both roll back their fixtures. Authenticated wallet/referral APIs/UI are implemented; the internal reserve/consume/restore core is implemented, while production checkout/transition adapter wiring remains.

Production purchase/transition wiring to the reward core, hosted avatar configuration/verification, password change/reset emails, organizer decisions/statistics, actual attendance, notification delivery, Feature 1 organizer/rating links and evaluator deployment remain. Own-name edits and public organizer identity are implemented, alongside users, the event/purchase starter, sessions/seeds, atomic referral issuance, backend auth, guards, protected reads and connected frontend auth/wallet reads. SQL transactions protect sessions, signup and picture-key swaps. See the [dated completion plan](../docs/shared/feature-2-completion-plan.md).

The `x-demo-persona` header is deliberately only a demo selector. Production identity must come from the agreed authenticated session, never from a caller-supplied user ID or role.

Shared UX working defaults, alternatives and their effect on both features are recorded in the [canonical UX reference](https://github.com/wilisail/event-management-platform-pwdk/blob/main/docs/shared/ux-reference.md). Defaults remain open to changes following input.

## Ownership

- feature 1 author: Rizky; event discovery/creation, purchasing/vouchers, reviews.
- feature 2 author: Wili; accounts/rewards/profiles/dashboard. This initial feature 2 implementation is agent-assisted.
- Theme and product name: adopted from Rizky's feature 1 prototype, commit `cd582753a480d68ce14e00021a52f8ec93d8372f`.
- This folder contains feature 2's own frontend, demo backend, contracts, tests, and run instructions. Reusing the theme does not transfer feature 1 authorship.


