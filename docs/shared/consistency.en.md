# Project record

[Shared index](README.md) · [UX reference](ux-reference.md) · [Technical reference](technical-reference.md)

Updated: 18 October 2026.

## Current baseline

| Item | Record |
| --- | --- |
| Visual direction | Rizky's TemuEvent feature 1 UI pushed to this repository, accepted in [PR #1](https://github.com/wilisail/event-management-platform-pwdk/pull/1). Feature 2 follows this direction and subsequent styling updates. The [UI reference](../ui/README.md) links the original push and records the reusable values. |
| Styling | Tailwind, shadcn setup, rounded cards/buttons, light surfaces, purple/indigo and pink accents. Source: [feature 1 stylesheet](../../app/globals.css) and feature 1 components. |
| Logo | Direct PNG export of Rizky's original rendered header. The repository welcome page and both feature 2 headers use identical PNG bytes at 140 × 28 CSS pixels. Source, theme and verification: [UI reference](../ui/README.md). |
| Colors/font | Source-derived background `#fcf9ff`, text `#11103d`, primary `#5148df` / `#4f46e5`, accent `#e539a7`, border `#ebe7f5`, Arial/Helvetica/sans-serif, heading weight 900, 24px panels and 12px actions. Shared gradient/hero treatments follow the feature 1 stylesheet. |
| Frontend | Current prototypes: Next.js + React + TypeScript. The earlier proposal mentioned Vite; final project setup remains to be confirmed. |
| Backend/API | feature 2 preview: Express + TypeScript, REST/JSON, read-only fixture data. feature 1 business backend is pending. |
| Database | PostgreSQL development project `temuevent` is active on Supabase in Singapore. Initial user table, two development identities and Prisma 7.10.1 connection code are prepared. Live app connectivity and authentication are pending; see [database setup](database-setup.md). |
| Seed data | One customer and one organizer are seeded. Approximately 30 sample transactions with related events/tickets/rewards follow once the purchase schema aligns with feature 1. |
| feature 2 preview | [Draft PR #2](https://github.com/wilisail/event-management-platform-pwdk/pull/2): separately runnable account/reward UI and demo API, plus initial database connection code. Authentication, reward/purchase persistence, redemption, approval and email are pending. |

## Feature ownership

| Owner | Frontend and backend scope |
| --- | --- |
| Rizky — feature 1 | Event discovery/details/creation; purchases, payment proof, event vouchers, timeouts/restoration; reviews/ratings. |
| Wili — feature 2 | Authentication/roles; referrals, points/platform coupons, profiles; organizer dashboard, decisions, attendee list and email. |
| Shared | UI conventions, cross-feature UX, API/data contracts, overlapping migrations and integration checks. Wili coordinates integration. |

Working assumption: separately runnable demonstrations with identifiable feature 1/feature 2 contributions. Final submission format follows the evaluator's requirements. Latest scoring: feature 1 4/4/2; feature 2 authentication 4, referrals/profiles 4, dashboard 2.

## Shared requirements

- Account required to purchase; customer/organizer roles; protected UI and backend authorization.
- Six transaction statuses: waiting for payment, waiting for admin confirmation, done, rejected, expired, canceled. Two-hour proof deadline; cancellation after three days without an organizer decision.
- Referral award: 10,000 points to the referrer and a coupon to the referred registrant. Points/coupons expire after three months.
- Restore applicable rewards and capacity on rejection, cancellation or expiry. Related writes use SQL transactions; overlapping rejection/expiry must restore only once.
- IDR, responsive UI, confirmation dialogs, empty states, tests for each flow and attendance before review.

## Shared interfaces

| Interface | feature 1 | feature 2 | Open detail |
| --- | --- | --- | --- |
| Purchase identity | Checkout | Authentication/session | Login return flow and authenticated identity payload |
| Checkout rewards | Calculate/reserve/redeem/restore | Issue and expose points/coupons | Combination, order, expiry while reserved, restoration allocation |
| Organizer decisions | Purchase states, proof and timeout process | Dashboard and accept/reject action | One authoritative state/restoration process; decision deadline |
| Attendance/reviews | Review eligibility and rating aggregate | Attendee records and organizer profile | Attendance confirmation and aggregate response |
| Event management | Event data/forms | Organizer dashboard entry | Shared edit form/API boundary |
| Database | Event/purchase/voucher/review entities | User/referral/reward/session/attendance entities | IDs, relationships, migration sequence/ownership |

The [feature 2 contract](https://github.com/wilisail/event-management-platform-pwdk/blob/feature-2/feature-2/contracts/README.md) is a proposal. Demo balances, IDs, `x-demo-persona` and the Rp25,000 coupon are fixture data. Coupon value, production authentication, date/time semantics and application deployment remain open. The development database is provisioned; its current setup is recorded separately.

The five UX working defaults and alternatives are in the [UX reference](ux-reference.md). They are open to changes following input; the reference records how a change affects both features. Proposed defaults for authentication, reward reservation/expiry, data formats and the integrated backend are recorded in the [technical reference](technical-reference.md). Coupon value and final infrastructure provisioning remain open; shared defaults can change following input.

## Integration

Working branches: `feature-1`, `feature-2`. Proposed merge flow: feature PR → `integration` → combined checks → PR to `main`. Shared notes can be updated on `main` and carried into `integration`.

Combined check: referral registration → reward issuance → checkout → proof upload → organizer decision → status/reward/capacity/email checks. Each developer implements and fixes their own feature; shared interfaces are reviewed together.
