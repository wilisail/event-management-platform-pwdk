# Consistency reference — English

[Shared index](README.md) · [Bahasa Indonesia](consistency.id.md) · [UX choices and vote results](ux-votes.md)

Updated: **18 October 2026**. This document distinguishes PRD requirements, accepted styling, prototype implementation and proposals still open for discussion.

## 1. Accepted styling

Wili accepted Rizky's TemuEvent visual direction through [PR #1](https://github.com/wilisail/event-management-platform-pwdk/pull/1). Rizky leads F1's visual direction; F2 follows it. Wili will adapt F2 to subsequent shared styling changes and update these notes. Cross-feature behavior and data changes remain joint discussion points.

Starting references: [F1 stylesheet](../../app/globals.css) and components in prototype commit [`cd58275`](https://github.com/wilisail/event-management-platform-pwdk/commit/cd582753a480d68ce14e00021a52f8ec93d8372f).

| Area | Prototype reference |
| --- | --- |
| Name | TemuEvent |
| Background and text | `#fcf9ff`, white surfaces; text `#11103d` |
| Primary color | Purple/indigo, including `#5148df` and `#4f46e5` |
| Accent | Pink, including `#e539a7`; purple–pink gradients |
| Border | `#ebe7f5` |
| Font | Arial, Helvetica, sans-serif |
| Components | Rounded cards and buttons, comfortable spacing, responsive layout |
| Current UI implementation | React + Next.js + TypeScript, Tailwind and shadcn setup |

These values record the accepted prototype. Accepting styling does not automatically settle sample reward values or every demo checkout behavior.

## 2. PRD requirements

- F1: event discovery/details/creation; purchasing, promotions and transaction states; reviews after attendance.
- F2: authentication/authorization; referrals/rewards/profiles; organizer dashboard, transaction decisions, emails and attendee list.
- Two roles: customer and organizer. Purchasing requires an account; permissions are checked on the backend.
- Six statuses: waiting for payment, waiting for admin confirmation, done, rejected, expired, canceled. Two hours to upload proof; automatic cancellation after three days without an organizer decision. The three-day start time needs agreement.
- The referrer earns 10,000 points; the referred registrant gets a coupon. Points and coupons last three months. The PRD does not specify the coupon amount.
- Restore applicable points/coupons/vouchers and capacity after rejection, expiry or cancellation; repeated processing must not duplicate restoration.
- IDR, responsive UI, protected routes, relevant confirmation dialogs, empty states, unit tests for each flow, and SQL transactions for related writes.

Latest rubric: F1 = **4 + 4 + 2**; F2 = **4 authentication + 4 referrals/profiles + 2 dashboard**. UI mockups do not yet satisfy the backend requirements. The supplied brief does not require a payment gateway, microservices, Redis or a QR scanner.

## 3. System status and technical choices

| Area | Current status |
| --- | --- |
| Frontend | Root F1 uses Next.js, React and TypeScript rather than Vite. The F2 preview follows this UI stack and runs separately. |
| Backend/API | F1's prototype has no business backend. F2's preview has a read-only Express + TypeScript REST/JSON API with fixtures. It is not production authentication or transaction processing. |
| ORM/database/hosting | **Wili's proposal:** Prisma + PostgreSQL on Supabase, following the course. MySQL with a compatible host remains an alternative. No final selection or provisioning was made through this work. |
| Seed data | Wili plans to help with hosting and roughly 30 sample transactions plus related users/events/tickets after the format is agreed. |
| Deployment | Pending. Check the chosen service's free-tier limits and how its scheduler can run. |

Prisma is an ORM; PostgreSQL/MySQL are databases; Supabase is a proposed PostgreSQL provider. The supplied PRD mandates no particular provider or ORM. Some course material uses Next.js, while the full-stack exercise uses Vite. Keeping the Next.js prototype is the current direction to retain the UI work; it does not finalize the entire architecture.

## 4. Ownership and shared boundaries

Each developer still owns the frontend **and** backend of their feature. The working assumption is separately runnable/demoable features for clear contribution review; the evaluator's rules determine the final assessment format.

| Owner | Scope | Shared boundary |
| --- | --- | --- |
| Rizky / F1 | Events, purchases, payment proofs, timeouts, event vouchers, reviews | Customer identity, checkout rewards, dashboard data and attendance evidence |
| Wili / F2 | Accounts/roles, referrals, points/platform coupons, profiles, dashboard, organizer decisions and email | Event/purchase identity, ticket quantities/prices, states, deadlines, restoration and organizer ratings |
| Both | Cross-feature UX, API/data formats, integration | IDs/relations, error format, auth handoff, states, discount rules, deadlines, contracts and migrations |

One boundary to confirm: F1's create/edit event form can be opened from F2's dashboard, avoiding two edit-rule implementations. F1 could provide the purchase transition/restoration process used by F2 organizer decisions. The final service/API arrangement remains open.

Initial F1 entities: events, ticket types, purchases/items, payment proofs, event vouchers and reviews. Initial F2 entities: users/profiles, referral registrations, point grants, platform coupons, sessions/password resets and attendance. Agree overlapping table names, IDs, relations and migration ownership together. F2 does not exclusively own the schema. Point batches need remaining amounts and redemption allocations for accurate expiry/restoration.

In the combined application, purchase creation, capacity reservation and reward redemption need consistent SQL transactions. F1 expiry and F2 rejection use one restoration process that prevents double restoration. The available prototypes do not implement this yet.

## 5. Proposed contracts and open decisions

Review the [proposed F2 contract](https://github.com/wilisail/event-management-platform-pwdk/blob/feature-2/feature-2/contracts/README.md) and [data types](https://github.com/wilisail/event-management-platform-pwdk/blob/feature-2/feature-2/contracts/types.ts) through [draft PR #2](https://github.com/wilisail/event-management-platform-pwdk/pull/2). The `/api/demo/...` endpoints, `x-demo-persona`, 20,000-point balance, Rp25,000 coupon and sample IDs are prototype data. The demo header must not become production authentication.

The five shared choices are in the [vote record](ux-votes.md). **All results are pending.** Discuss technical details when needed: session/token handling, final API contract, coupon value, rewards expiring while held, three-month/timezone interpretation, database/hosting and migration order. F2's prototype uses three calendar months in UTC with month-end clamping; confirm this proposed implementation before real purchase integration.

## 6. Git and integration

- Rizky can commit/push to `feature-1`; Wili to `feature-2`. Every push to one's working branch does not require a PR.
- Wili takes the integration-coordination role. Proposed workflow: feature PR → `integration`, combined journey checks → PR into `main`. Shared documentation can go through a documentation PR into `main`, then into `integration`.
- Branch names do not enforce exclusive ownership. On 18 October 2026, Rizky had **write** permission, `main`/`integration` were unprotected and no rulesets were configured. GitHub therefore does not enforce Wili-only merging; integration coordination is a working arrangement rather than an active access restriction.
- Preserve commit history and separate run instructions for contribution review. Both developers help verify combined journeys; the integrator does not replace either developer's implementation responsibility.
- Keep database credentials in backend environment settings; commit only `.env.example` without secret values. Wili can help provision hosting, while cross-feature schema changes are discussed together.
