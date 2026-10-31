# Shared technical reference

[Project record](consistency.en.md) · [UX reference](ux-reference.md)

Updated: **31 October 2026**. Status: proposed implementation defaults, open to changes following input. This record covers the database and backend boundaries connecting feature 1 and feature 2. Feature 1's internal implementation remains with Rizky; feature 2's remains with Wili.

## 1. Implementation status

| Area | Current repository state |
| --- | --- |
| Frontend | Both applications use Next.js, React, TypeScript and Rizky's TemuEvent styling, and run separately. Feature 2 now has connected registration/login, protected account and owned organizer pages; the earlier fixtures remain at `/preview`. See [frontend authentication](frontend-authentication-reference.md). |
| Feature 2 backend | Express + TypeScript with database-backed registration/login/refresh/logout, reusable authentication/role/CSRF guards, `/api/me` and owned organizer event/attendee reads. Frontend auth is connected through a same-origin `/api` rewrite and session client. [Implementation](https://github.com/wilisail/event-management-platform-pwdk/blob/feature-2/feature-2/server/app.ts) and [response types](https://github.com/wilisail/event-management-platform-pwdk/blob/feature-2/feature-2/contracts/types.ts). |
| Database/authentication | [TemuEvent database](database-setup.md) is active on Supabase in Singapore. Users, event/ticket/purchase starter, 30 demo purchases and account/session tables are applied. Prisma 7.10.1 live connectivity and real HTTP registration/login/refresh/logout passed. See [account/session foundation](account-session-foundation.md) and [login/session reference](login-session-reference.md). |
| Purchases and decisions | Purchase writes, reward reservation/restoration, organizer decisions and email delivery are pending. The proposed interfaces below are not implemented routes. |

## 2. Technical choices and change impacts

| Area | Working default | Alternative and impact on both features |
| --- | --- | --- |
| API | **Node.js + Express + TypeScript; REST/JSON.** Common validation/error format. | Another backend requires adapters for both clients and shared authorization/transaction services. |
| ORM | **Prisma ORM 7.10.1**, pinned with its client and PostgreSQL adapter in feature 2. | Prisma ORM 8 uses a different API; moving to it changes both features' database code. The current version 8 docs do not support MySQL. |
| Database/hosting | **PostgreSQL hosted on Supabase**. The `temuevent` development project is provisioned in Singapore, with an initial user schema. Express/Prisma connection verification has passed; see [database setup](database-setup.md). | MySQL with another host is possible with a compatible Prisma version. Both features need a consistent provider, migrations and database-specific query changes. The supplied PRD mandates neither host nor ORM. |
| Integrated backend | **One Express runtime with separate feature modules and one database/transaction authority** for the combined demonstration. Each feature retains a standalone entry point for individual demonstration. | Two independent deployed APIs/databases require distributed consistency work for checkout and reward changes. Separate development databases do not synchronize automatically. |
| Authentication | **Short-lived JWT access cookie plus rotating refresh cookie and server-side session records**, following the course's JWT/refresh-token material. | An opaque server session cookie is also possible. Keeping the identity response and shared auth middleware stable limits changes needed in feature 1. |
| Background work | **Persisted deadlines and a lightweight scheduled worker; SQL outbox for decision emails.** Deployment must provide an executor that runs the scheduled work. | Redis/BullMQ is optional and adds another hosted dependency. Both features must still use the same persisted deadlines and state-transition rules. |
| Common fields | **UUID production IDs serialized as strings; camelCase API fields; integer IDR amounts; UTC timestamps with Asia/Jakarta display.** | Numeric IDs or other formats require coordinated types, seed data and adapters. Feature 1's numeric demo IDs remain valid fixtures; adopting UUIDs requires replacing numeric-only ID parsing when connecting the real API. |

Supabase hosts the development PostgreSQL database. Authentication remains a separate feature 2 implementation; provisioning does not select Supabase Auth. Provider credentials belong in backend environment settings. Shared Prisma schema/migrations have one ordered history; both builders review changes to shared IDs/relations. Wili coordinates applying migrations and seeds, while each builder implements their own feature queries.

## 3. Database outline

The user foundation, [shared event/ticket/purchase starter](../../database/README.md) and [account/session tables](account-session-foundation.md) are implemented; reward, reset-token and attendance entities below remain proposed. See the [database setup and status](database-setup.md) for applied files, seed data and connection limitations. Tables use primary/foreign keys and appropriate indexes. Feature 1's complete event/purchase schema remains its builder's design.

| Entity / owner | Minimum fields or relationships | Cross-feature use |
| --- | --- | --- |
| `users` / feature 2 | `id`, unique normalized `email`, `passwordHash`, `name`, `role`, unique immutable `referralCode`, `profilePictureKey`, timestamps | Feature 1 purchase customer, event organizer and review author all reference `users.id`. Password hashes stay backend-only. |
| `organizer_profiles` / feature 2, optional | `userId`, `bio`; name/photo can remain on `users` | Public organizer information for event details. Ratings come from feature 1 reviews. |
| `referrals` / feature 2 | `id`, `referrerId`, unique `referredUserId`, `createdAt` | Registration, referral coupon and 10,000-point award commit together; one referral issuance per new account. |
| `point_grants` / feature 2 | `id`, `userId`, `amount`, `remainingAmount`, `creditedAt`, `expiresAt`, optional referral link | Separate earning batches preserve their three-month expiry. Feature 1 reserves points from these batches through a shared service. |
| `reward_coupons` / feature 2 | `id`, `userId`, `code`, `discountType`, `discountValue`, `issuedAt`, `expiresAt`, reservation/use state | Customer-owned platform coupons, distinct from feature 1's event vouchers. Coupon amount is still open. |
| `reward_redemptions` / shared; feature 2 reward service | `id`, unique `transactionId`, `userId`, optional `couponId`, `status`, timestamps | Links one purchase to reserved/consumed/restored rewards. Prevent multiple active claims on the same coupon. |
| `point_allocations` / shared; feature 2 reward service | `redemptionId`, `pointGrantId`, positive `amount`; unique pair | Records exactly which earning batches a purchase used, so rejection/expiry restores the correct batches once. |
| `auth_sessions`, `auth_refresh_tokens` / feature 2, applied | User/session foreign keys; session expiry/revocation; unique refresh-secret hashes with expiry and consumption history | Connected feature 2 login, refresh and logout use these records. Reusable guards verify the JWT, active session, current user role and CSRF/session binding. Organizer read queries enforce ownership; feature 1 wiring remains separate. |
| `password_reset_tokens` / feature 2, planned | User link, hashed one-time reset token, expiry and consumption | Password reset and session revocation remain a later account-flow batch. |
| `attendance` / feature 2 | `eventId`, `customerId`, qualifying `transactionId`, `markedByOrganizerId`, `attendedAt`; unique customer/event | Feature 1 checks attendance before accepting a review. Confirmed registration alone is not attendance. |
| `email_outbox` / feature 2 | Unique event key, `transactionId`, notification type, payload, delivery status and retry fields | Organizer decision commits before delivery; failed email delivery does not reverse a valid purchase decision. |
| Events/tickets/purchases/proofs/event vouchers/reviews / feature 1 | Shared references listed below; full schema stays with feature 1 | Feature 2 joins these records for organizer decisions, attendance and statistics. |

**Shared feature 1 projection:** event ID and organizer ID; transaction ID, customer ID and event ID; ticket type IDs, quantities and purchase-time prices; subtotal and each actual deduction; final payable amount; status; payment/decision deadlines; completion timestamp; authorized proof access. Use one event per transaction as the working default so ownership and voucher eligibility are unambiguous. Feature 2 can consume a mapped view instead of requiring identical internal column names.

## 4. API conventions

| Contract | Default |
| --- | --- |
| Identity | `id`, `name`, `email`, `role`, `profilePictureUrl`, `referralCode`. Roles: `CUSTOMER` / `ORGANIZER`. Public organizer responses omit private account fields. |
| Money | JSON numbers representing whole rupiah, validated within JavaScript's safe-integer range. One point reduces payment by Rp1, matching the PRD example and current demo type. Suggested storage: PostgreSQL `BIGINT`; convert explicitly at the API boundary rather than returning raw JavaScript `BigInt`. |
| Time | ISO-8601 UTC strings. The backend supplies `asOf`, `paymentDueAt` and `decisionDueAt`; both UIs display the same deadlines. Three months means calendar months with month-end clamping as the feature 2 working default. |
| Success | `{ "success": true, "message": "...", "data": ... }`; wallet responses also carry server time. |
| Error | `{ "success": false, "message": "...", "code": "..." }`. Use 400 invalid input, 401 unauthenticated, 403 forbidden, 404 missing, 409 state/availability conflict. |
| Validation | Zod at the API boundary. Recalculate prices, capacity and eligibility on the backend. A wallet response is information, not permission to spend its displayed balance. |
| Pagination | For list routes: `page`, `pageSize`; response `data.items` and `data.pagination`. Defaults and limits are shared once those routes are added. |

### Existing read-only routes

These currently use fixture identities selected by `x-demo-persona: customer` or `organizer`. That header is not production authentication. Feature 2 web runs on port 3001 and Express on 4002; feature 1 web can run on 3000.

| Implemented route | Consumer |
| --- | --- |
| `GET /api/demo/me` | Identity shape for shared navigation and purchase context |
| `GET /api/demo/me/rewards` | Customer point grants and platform coupons |
| `GET /api/demo/checkout-context` | Customer identity plus wallet for feature 1 checkout |
| `GET /api/demo/organizers/:organizerId` | Public organizer information; rating summary is unconnected |

Full demo payloads are in the [feature 2 contract](https://github.com/wilisail/event-management-platform-pwdk/blob/feature-2/feature-2/contracts/README.md). Demo IDs and values, including the Rp25,000 coupon, do not fix production values.

### Account and organizer routes owned by feature 2

| Route | Request / response boundary | Effect on feature 1 |
| --- | --- | --- |
| `POST /api/auth/register` — implemented on feature-2 | Validated name/email/password and optional CUSTOMER/ORGANIZER role; returns a safe account with a generated referral code. Incoming referral registration is explicitly rejected until atomic reward issuance is added. Registration deliberately does not issue a session. | Creates the account; login establishes authentication. See [registration reference](registration-reference.md). |
| `POST /api/auth/login`, `/refresh`, `/logout` — implemented on feature-2 | Login accepts email/password; login/refresh set HttpOnly credential cookies and return safe user, CSRF and expiry fields. Refresh rotates; reuse revokes the session. Logout revokes and clears cookies. | Feature 2's [session client](frontend-authentication-reference.md) is connected. Feature 1's chosen-ticket login handoff remains integration work; arbitrary external return URLs are not allowed. |
| `GET /api/auth/csrf` — implemented on feature-2 | Returns CSRF value bound to the refresh cookie; not proof of authentication | The feature 2 client supplies `X-CSRF-Token` on refresh/logout. New auth POSTs also require `X-TemuEvent-Client: web`; proof-upload protection will use the shared middleware when wired. |
| `GET /api/auth/session` — implemented on feature-2 | Session inspection checks signed access plus persisted session and returns safe identity | Available for session inspection; `/api/me` supplies the connected feature 2 pages. |
| `GET /api/me` — implemented on feature-2 | Safe authenticated identity from the verified session/current user; 401 without valid credentials | Identifies the purchase customer; frontend-supplied user IDs/roles do not authorize a purchase. |
| `GET /api/organizer/events` — implemented on feature-2 | Organizer-only, paginated owned event summaries | Dashboard read projection; feature 1 retains event creation/editing rules. No caller-selected organizer ID. |
| `GET /api/me/rewards`, `GET /api/checkout-context` | Wallet, or identity + wallet; balances/eligibility calculated at server `asOf` | Supplies points/coupon choices. Future coupon state adds `RESERVED` to the demo's `AVAILABLE`, `USED`, `EXPIRED` states. Feature 1 permits only `AVAILABLE` selections; feature 2 can show the reservation state. |
| `GET /api/organizers/:organizerId` | Public profile plus feature 1's rating aggregate | Event details can link to the profile; review calculations stay in feature 1. |
| `POST /api/organizer/transactions/:transactionId/decision` | `{ "decision": "ACCEPT" }` or `"REJECT"`; returns updated transaction view | Calls the shared purchase transition service; no separate restoration implementation in the dashboard. |
| `GET /api/organizer/events/:eventId/attendees` — implemented on feature-2 | Owned-event confirmed purchase rows: customer name/ID, purchase ID/reference, ticket quantity and total paid | DONE purchases only, including free confirmations. Other-owner/missing event returns 404; customer role returns 403. This is registration data, not actual attendance/check-in. |
| `POST /api/organizer/events/:eventId/attendance` | Target `customerId` and qualifying `transactionId`; returns attendance record | Supplies backend review eligibility. Actor must own the event. |
| `GET /api/organizer/statistics` | Date range and `groupBy=day|month|year`; owned-event aggregates | Requires consistent purchase totals/completion dates. Default revenue counts `DONE` final paid amounts at completion time; zero-price orders contribute zero revenue. |

Feature 1 owns the routes for events, checkout, proof upload, transaction viewing and reviews. The shared need is a stable purchase/attendance/reward view; its internal route/controller organization stays with its builder. Route names above remain open to input before production wiring.

## 5. Authentication and file access

Feature 2's reusable guards verify signed access, the active persisted session and the current user role. Owned organizer read queries filter records by that verified identity. The write guard additionally binds CSRF/refresh credentials to the same session and supports multipart uploads. Feature 1 must explicitly mount the shared guards when its protected backend routes are integrated; their existence does not secure other routes automatically. See [authorization reference](authorization-reference.md).

Cookies are HttpOnly, host-only, SameSite=Lax and Secure with __Host- names in production. Auth writes use JSON, a custom application header, allowed origins and CSRF checks for refresh/logout. Prefer same-origin `/api` routing. Local separate origins need consistent hostnames, explicit allowlisting and credentialed requests. Unrelated frontend/API sites are not supported by the current cookie settings.

Working lifetimes are 15-minute access and a seven-day absolute session; the PRD does not specify these durations. A backend-only `AUTH_JWT_SECRET` is required alongside `DATABASE_URL`. Both are supplied outside Git. Refresh requests must be coordinated, including across tabs, because consumed-token reuse revokes that session. See the [implemented session contract and boundaries](login-session-reference.md).

Feature 2 now has a credentialed request helper with coordinated expiry/refresh handling and a consistent 401 response. Feature 1 can adopt it or an agreed adapter during integration. Do not blindly retry purchase/file mutations after refresh; purchase retries need an idempotency key so one customer action cannot create two purchases.

Feature 1 owns payment-proof upload; feature 2 owns profile pictures. Use storage keys internally. Payment proofs require customer/owning-organizer authorization and a protected download or short-lived signed URL; profile-image URLs can be public. Storage provider remains open. SQL transactions update file metadata; file transfer itself stays outside the database transaction.

## 6. Purchase/reward transaction boundary

PRD basis: Feature 1 → Event Transaction → Purchasing, Point Usage, Automatic Status Changes, Rollbacks and Seat Restoration; Feature 2 → Event Management Dashboard → Transaction Management and Notification Emails; Notes → SQL transactions for related modifications.

| Process | Lead implementation | Shared operation |
| --- | --- | --- |
| Create purchase | Feature 1 | One SQL transaction validates identity/availability, writes purchase/items, reserves seats/voucher and reserves feature 2 rewards. |
| Reserve/consume/restore rewards | Feature 2 reward service | Accepts the caller's database transaction context and records the exact coupon/point allocations. |
| Accept/reject/expire/cancel | Feature 1 purchase transition service; feature 2 calls it for organizer decisions | One SQL transaction changes state, consumes or restores resources, and records any required notification event. |
| Send decision email | Feature 2 | Outbox worker sends after commit and retries delivery. |

For Prisma 7, shared helpers accept the same `Prisma.TransactionClient` used by the caller's `prisma.$transaction(...)`. A helper must not independently commit reward changes on another connection. An HTTP call to a second backend is not part of that SQL transaction. Use row locks/conditional updates or serializable transactions with bounded conflict retries to prevent overselling and double spending.

Working reward behavior: reserve the earliest-expiring valid point grants first; reduce `remainingAmount` at reservation and retain allocations. Confirmation changes reservation to consumption without deducting twice. Restoration returns the allocations once to their original grant/coupon with the original expiry; expired rewards remain expired and are excluded from spendable balances. Derive point expiry from grant dates without deleting grant/allocation history. A reward valid when reserved can remain applied while payment awaits review. This interpretation is open to input and needs shared tests before real checkout.

**Change impact:** altering reward reservation/expiry affects feature 1 checkout totals and transaction restoration, and feature 2 wallet availability and organizer rejection. Keeping these operations in one shared service prevents the two features from applying different rules.

## 7. Status and deadline contract

These proposed API enum names map to the six PRD statuses. Zero-payable behavior follows the [UX reference](ux-reference.md).

| From | Action | To |
| --- | --- | --- |
| New paid purchase | Authenticated checkout; reserve resources | `WAITING_FOR_PAYMENT` |
| `WAITING_FOR_PAYMENT` | Successful proof upload before `paymentDueAt` | `WAITING_FOR_ADMIN_CONFIRMATION` |
| `WAITING_FOR_ADMIN_CONFIRMATION` | Owning organizer accepts before `decisionDueAt` | `DONE` |
| `WAITING_FOR_ADMIN_CONFIRMATION` | Owning organizer rejects before the deadline | `REJECTED` |
| `WAITING_FOR_PAYMENT` | Proof deadline reached | `EXPIRED` |
| `WAITING_FOR_ADMIN_CONFIRMATION` | Decision deadline reached | `CANCELED` |
| New zero-payable registration | Confirm registration and account for resources | `DONE` |

`paymentDueAt = checkout time + 2 hours`; `decisionDueAt = successful proof time + 72 hours`. These are persisted server deadlines. A scheduler scans overdue purchases and catches up after restarts; request-time guards also enforce deadlines. Repeated identical terminal actions return the existing result without restoring twice; conflicting terminal actions return 409. Lock/compare current state so proof upload, timeout and organizer actions cannot all win a race. Customer-initiated cancellation is not added by this contract.

## 8. Integration, migrations and checks

- Wili has provisioned the development database and seeded a customer and organizer. Thirty demo purchases spanning all six statuses are now seeded with related users/events/ticket items. Reward allocations remain a separate implementation step. Each builder implements their own frontend/backend functionality against the data.
- Seeds use stable linked IDs and consistent capacity/reward allocations. Standalone demonstrations can use separate copies of the same fixtures; the integrated application uses one authoritative dataset.
- Shared schema changes use versioned migrations. Wili coordinates migration order; both builders review changed shared IDs, constraints and payloads. Provider/ORM-major changes are recorded here before dependent code changes.
- Integration checks cover: authenticated identity; forbidden cross-organizer access; valid referral registration; valid/expired/reserved rewards; duplicate purchase retry; last-seat concurrency; proof/deadline boundaries; accept/reject racing cancellation; restoration once; zero-payable registration; attendance-gated review; decision email retry.

## References

- Course: Express/TypeScript, Prisma/PostgreSQL integration, JWT/refresh tokens, validation/files/email, scheduling and SQL transaction exercises supplied in the project discussion.
- [Prisma ORM 7 supported databases](https://www.prisma.io/docs/orm/v7/reference/supported-databases)
- [Prisma ORM 7 transactions](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions)
- [Prisma ORM 8 transaction/API differences](https://www.prisma.io/docs/orm/fundamentals/transactions)
- [Prisma ORM 7 BigInt serialization](https://www.prisma.io/docs/orm/v7/prisma-client/special-fields-and-types)
- [Supabase PostgreSQL](https://supabase.com/docs/guides/database/overview)
- [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP CSRF protection](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

Checked 31 October 2026. Prisma 7.10.1 connectivity, HTTP authentication, reusable guards, owned organizer reads and the connected frontend/session client are verified. TypeScript, 74 tests, a production build and the real HTTPS client/service flow passed; password-form submission and multiple-tab browser behavior remain manual release checks. No schema/grant/dependency change was needed for frontend wiring. See the [companion note](frontend-authentication-reference.md) and [remaining plan](feature-2-completion-plan.md).

