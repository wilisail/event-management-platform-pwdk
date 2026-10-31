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

`POST /api/auth/register` validates JSON, normalizes email, hashes passwords with Node scrypt, generates an immutable referral code and creates an account. The `/register` form is connected. It returns a safe identity without issuing a login cookie; the success screen offers separate login. A nonempty incoming referral is explicitly rejected until reward issuance is atomic.

The existing private DATABASE_URL enables the route; without it, registration returns 503 and the fixture preview remains available. The backend trusts the included public Supabase CA by default. See [registration reference](../docs/shared/registration-reference.md) for inputs, status codes, layering and learning notes.

`npm run db:verify:registration` starts a real HTTP server, writes/reads accounts through Prisma against Supabase, verifies hashes and duplicate handling, then rolls back test accounts. TypeScript, unit/API tests, live verification and a clean npm ci passed on 31 October 2026.

## Login and sessions

The backend implements `/api/auth/login`, `/refresh`, `/logout`, `/csrf` and `/session`. Password login creates a database session; HttpOnly cookies carry signed access and random refresh credentials. Refresh rotates once and detects reuse; logout revokes the session. Working defaults: fifteen-minute access and a seven-day absolute session.

Add the private `AUTH_JWT_SECRET` from the backend handoff alongside DATABASE_URL in the ignored `.env`. Without that key, session routes return 503 while registration and the fixture preview remain available. See [login/session mechanics, request headers and CSRF contract](../docs/shared/login-session-reference.md). Connected forms, account navigation, guarded pages and refresh/logout coordination are explained in the [frontend companion note](../docs/shared/frontend-authentication-reference.md).

`npm run db:verify:sessions` exercises the real HTTP/database flow and rolls back temporary accounts/sessions/tokens. TypeScript, 57 unit/API tests, live verification, the actual backend bootstrap and a clean install/client generation passed on 31 October. No migration or permission change was needed.

## Protected identity and organizer reads

`GET /api/me` uses the real authenticated identity. Organizer-only `/api/organizer/events` and `/api/organizer/events/:eventId/attendees` read only the caller's owned events and confirmed purchase rows. Reusable authentication/role/CSRF guards are available for future protected operations. The attendee projection is registration data, not check-in proof.

See the [authorization companion note](../docs/shared/authorization-reference.md) for middleware order, ownership filters, 401/403/404 behavior, pagination and the effect on both features. TypeScript, all 66 unit/API tests and real HTTP/database authorization verification passed. `npm run db:verify:authorization` checks the flow with a customer and two organizers and rolls back its temporary data. No new dependency, schema, grant or secret is required.

## What works in the fixture preview

The original fixture application is now at `/preview`. The real `/account` page uses `/api/me` and does not show the example points/coupons as actual rewards. Profile edits and real wallet operations are pending.

- Customer and organizer **demo persona** selection; this is not authentication.
- Account profile UI, immutable referral-code display/copy, and a local profile-edit confirmation dialog.
- Reward wallet loaded from the Express API, including active/expired point grants and coupons.
- Public organizer profile, with an empty review/rating slot for the feature 1 review module.
- Typed proposed feature 1/feature 2 data shapes in `contracts/types.ts`.
- Referral-grant and calendar-expiry functions with tests; no rewards are actually issued or redeemed.
- Read-only checkout-context response that feature 1 can inspect without changing its current prototype.

The fixtures match feature 1's example of 20,000 points and `WELCOME25`. **The Rp25,000 coupon amount is a demonstration value, not a settled product rule.** Expired samples are shown for empty/error-state work.

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

Next.js type errors are not suppressed. All 74 tests, TypeScript and a production build passed on 31 October. The tests cover reward/date boundaries, authentication/session rules, real permission middleware, ownership/pagination, CSRF and the new client refresh/error/return-path behavior. The real HTTPS client → Next rewrite → Express → Prisma → Supabase path passed with rolled-back QA data; login/signup pages were visually inspected. Password-form submission and multiple-tab UI behavior remain manual release checks.

`scripts/serve-browser-check.ts` is an explicitly enabled loopback QA server that places temporary accounts/events/purchases/sessions in one rollback transaction. `scripts/verify-frontend-client.ts` tests the real client against that server via an HTTPS preview, with disposable credentials supplied through process environment settings. These QA runners are not the normal application entry point or public control endpoints; never run the verifier against the ordinary persistent server. The normal development command remains `npm run dev`.

## What remains before a graded submission

The referral/reward database foundation is applied and verified: five models, independent point/coupon expiry, ownership constraints and purchase-linked claims/allocations. See the [schema companion note](../docs/shared/referral-reward-schema-reference.md). `npm run db:verify:rewards-schema` tests the real constraints and permissions and rolls back its temporary data. This storage foundation does not yet enable incoming-referral signup, issue rewards or replace the fixture wallet; those are the next subparts.

Incoming referral registration with atomic rewards, real wallet/redemption persistence, profile edits/avatar uploads, password change/reset emails, organizer decisions/statistics, actual attendance, notification delivery, public organizer integration and evaluator deployment remain to be implemented. Users, the event/purchase starter, sessions and seeds are implemented, together with backend registration/login/refresh/logout, reusable guards, protected identity/organizer reads and connected frontend auth. SQL transactions already protect session/refresh writes and will also protect coupled purchase/reward writes. See the [dated completion plan](../docs/shared/feature-2-completion-plan.md) for daily subtasks and time ranges.

The `x-demo-persona` header is deliberately only a demo selector. Production identity must come from the agreed authenticated session, never from a caller-supplied user ID or role.

Shared UX working defaults, alternatives and their effect on both features are recorded in the [canonical UX reference](https://github.com/wilisail/event-management-platform-pwdk/blob/main/docs/shared/ux-reference.md). Defaults remain open to changes following input.

## Ownership

- feature 1 author: Rizky; event discovery/creation, purchasing/vouchers, reviews.
- feature 2 author: Wili; accounts/rewards/profiles/dashboard. This initial feature 2 implementation is agent-assisted.
- Theme and product name: adopted from Rizky's feature 1 prototype, commit `cd582753a480d68ce14e00021a52f8ec93d8372f`.
- This folder contains feature 2's own frontend, demo backend, contracts, tests, and run instructions. Reusing the theme does not transfer feature 1 authorship.

