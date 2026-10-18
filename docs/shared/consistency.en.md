# Project record

[Shared index](README.md) · [UX choices](ux-votes.md)

Updated: 18 October 2026.

## Current baseline

| Item | Record |
| --- | --- |
| Visual direction | Rizky's TemuEvent prototype, accepted in [PR #1](https://github.com/wilisail/event-management-platform-pwdk/pull/1). F2 follows this direction and subsequent styling updates. |
| Styling | Tailwind, shadcn setup, rounded cards/buttons, light surfaces, purple/indigo and pink accents. Source: [F1 stylesheet](../../app/globals.css) and F1 components. |
| Colors/font | Background `#fcf9ff`; text `#11103d`; primary `#5148df` / `#4f46e5`; accent `#e539a7`; border `#ebe7f5`; Arial/Helvetica/sans-serif. |
| Frontend | Current prototypes: Next.js + React + TypeScript. The earlier proposal mentioned Vite; final project setup remains to be confirmed. |
| Backend/API | F2 preview: Express + TypeScript, REST/JSON, read-only fixture data. F1 business backend is pending. |
| Database | Proposal: Prisma + PostgreSQL on Supabase, aligned with the course. MySQL with another compatible host remains an alternative. No database provisioned through this work. |
| Seed data | Wili plans hosting setup and approximately 30 sample transactions with related users/events/tickets once the schema is agreed. |
| F2 preview | [Draft PR #2](https://github.com/wilisail/event-management-platform-pwdk/pull/2): separately runnable account/reward UI and demo API. Authentication, persistence, redemption, approval and email are pending. |

## Feature ownership

| Owner | Frontend and backend scope |
| --- | --- |
| Rizky — F1 | Event discovery/details/creation; purchases, payment proof, event vouchers, timeouts/restoration; reviews/ratings. |
| Wili — F2 | Authentication/roles; referrals, points/platform coupons, profiles; organizer dashboard, decisions, attendee list and email. |
| Shared | UI conventions, cross-feature UX, API/data contracts, overlapping migrations and integration checks. Wili coordinates integration. |

Working assumption: separately runnable demonstrations with identifiable F1/F2 contributions. Final submission format follows the evaluator's requirements. Latest scoring: F1 4/4/2; F2 authentication 4, referrals/profiles 4, dashboard 2.

## Shared requirements

- Account required to purchase; customer/organizer roles; protected UI and backend authorization.
- Six transaction statuses: waiting for payment, waiting for admin confirmation, done, rejected, expired, canceled. Two-hour proof deadline; cancellation after three days without an organizer decision.
- Referral award: 10,000 points to the referrer and a coupon to the referred registrant. Points/coupons expire after three months.
- Restore applicable rewards and capacity on rejection, cancellation or expiry. Related writes use SQL transactions; overlapping rejection/expiry must restore only once.
- IDR, responsive UI, confirmation dialogs, empty states, tests for each flow and attendance before review.

## Interfaces to confirm

| Interface | F1 | F2 | Open detail |
| --- | --- | --- | --- |
| Purchase identity | Checkout | Authentication/session | Login return flow and authenticated identity payload |
| Checkout rewards | Calculate/reserve/redeem/restore | Issue and expose points/coupons | Combination, order, expiry while reserved, restoration allocation |
| Organizer decisions | Purchase states, proof and timeout process | Dashboard and accept/reject action | One authoritative state/restoration process; decision deadline |
| Attendance/reviews | Review eligibility and rating aggregate | Attendee records and organizer profile | Attendance confirmation and aggregate response |
| Event management | Event data/forms | Organizer dashboard entry | Shared edit form/API boundary |
| Database | Event/purchase/voucher/review entities | User/referral/reward/session/attendance entities | IDs, relationships, migration sequence/ownership |

The [F2 contract](https://github.com/wilisail/event-management-platform-pwdk/blob/feature-2/feature-2/contracts/README.md) is a proposal. Demo balances, IDs, `x-demo-persona` and the Rp25,000 coupon are fixture data. Coupon value, production authentication, date/time semantics, database/hosting and deployment remain open.

## Integration

Working branches: `feature-1`, `feature-2`. Proposed merge flow: feature PR → `integration` → combined checks → PR to `main`. Shared notes can be updated on `main` and carried into `integration`.

Combined check: referral registration → reward issuance → checkout → proof upload → organizer decision → status/reward/capacity/email checks. Each developer implements and fixes their own feature; shared interfaces are reviewed together.
