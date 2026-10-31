# Feature 2 — remaining implementation plan

Prepared: 31 October 2026, Asia/Jakarta. These are focused working-time estimates including implementation, relevant checks and companion explanations. They are planning ranges, not scheduled automations or promises of elapsed delivery time. Adjust the pace when a foundation needs more explanation.

Progress, 1 November: day 2 subpart 1 is complete. The five referral/reward tables and additive migration are applied; both Prisma schemas validate, TypeScript and the existing 74 tests pass, and live constraints/ownership/permissions checks roll back their fixtures. See the [companion note](referral-reward-schema-reference.md). Next is atomic referral signup and reward issuance, estimated 60–90 minutes. The wallet and reservation/restoration service remain later subparts today.

## Starting point after today

Implemented on `feature-2`: real registration, password hashing, persisted sessions/refresh rotation/logout, role/ownership guards, protected identity/event/confirmed-attendee APIs, and their connected account/login/organizer frontend. The shared PostgreSQL/Prisma starter and 30 sample purchases already exist. See the [frontend authentication checkpoint](frontend-authentication-reference.md).

Not complete: incoming referrals/rewards and persistence; profile changes/uploads; password change/reset; organizer decisions/notification emails/statistics; attendance recording; real public organizer profile integration; final combined testing/deployment. Fixture pages and sample rows do not count as finished business flows.

The latest scoring is authentication/authorization **4**, referrals/profile/rewards **4**, organizer dashboard **2**. Completion means satisfying every required behavior, not merely obtaining the largest scoring items.

## Sunday, 1 November — referrals and real rewards

| Subtask | Time | Checkpoint / why it matters |
| --- | --- | --- |
| Referral, point-grant, coupon and redemption schema/migrations | 45–60 min | Preserve separate earning batches, original expiry, owner and purchase links. Review shared relations before applying additive migrations. |
| Atomic referral registration and reward issuance | 60–90 min | One SQL transaction creates the account, records the referral, issues the newcomer's coupon and awards the referrer 10,000 points; invalid/duplicate attempts cannot issue twice. |
| Real wallet/referral UI and expiry rules | 45–60 min | Replace examples with the authenticated account's available points/coupons. Test three calendar months, month ends and timezone boundaries. |
| Shared reserve/consume/restore reward service and tests | 60–90 min | Supply feature 1 with one transaction-aware interface and allocations. Restore the correct original batches/coupon once; expired rewards remain unspendable. |
| **Total** | **3½–5 h** | Companion note explains SQL atomicity, earning batches, expiry and idempotency. |

The referral coupon amount is unspecified by the PRD. Rp25,000 is an existing prototype value, still open to input. The database should store the issued amount rather than hardcode it throughout checkout.

## Monday, 2 November — profile and password lifecycle

| Subtask | Time | Checkpoint / why it matters |
| --- | --- | --- |
| Profile editing and picture upload | 45–75 min | Validate fields/files, enforce ownership, persist the storage key and update the real profile. Connect public organizer details; rating data remains feature 1's adapter. |
| Password change and session revocation | 45–60 min | Verify the current password, hash the replacement and invalidate existing sessions under the agreed policy. |
| Forgotten-password reset with email | 45–75 min | Non-enumerating response; hashed, expiring, single-use reset token; reset and session revocation commit together. Verify real email delivery and expired/reused links. |
| Account regression, responsive/error states and learning review | 45–60 min | Test permissions, invalid uploads, repeated submissions and password flows. Explain file storage versus database metadata and token versus password hashing. |
| **Total** | **3–4½ h** | Choose/configure a file-storage provider and email sender within the available free allocation. |

Storage/email provider credentials and the permitted sender belong in backend environment settings. Provider onboarding or email delivery restrictions can extend the estimate; no paid upgrade is assumed.

## Tuesday, 3 November — organizer decisions and notifications

| Subtask | Time | Checkpoint / why it matters |
| --- | --- | --- |
| Owned transaction list/detail and authorized payment-proof viewing | 60–90 min | Organizer can inspect only purchases for their own events; proof files are not public-by-default links. |
| Accept/reject API and UI using the shared purchase engine | 60–90 min | Guard valid status/deadline changes. Reject restores applicable seats, voucher/coupon and point allocations once, including a race with expiry. |
| Acceptance/rejection email outbox and retry worker | 45–75 min | Commit the decision and queued notification together. A delivery failure does not undo an accepted/rejected purchase. |
| Combined decision/deadline/restoration tests | 45–75 min | Exercise real proof and purchase data, repeated requests, concurrent expiry and ownership. Confirm customer-facing results agree with organizer UI. |
| **Total** | **3½–5½ h** | Companion note explains state transitions, SQL transactions, race protection and outbox delivery. |

Dependency: feature 1 owns the purchase/proof/timeout engine. The feature 2 decision endpoint must call that engine or the agreed shared transition service. A mocked success is not sufficient for this checkpoint; coordinate the interface early.

## Wednesday, 4 November — dashboard and cross-feature links

| Subtask | Time | Checkpoint / why it matters |
| --- | --- | --- |
| Organizer statistics APIs and day/month/year charts | 60–90 min | Aggregate owned events and actual transaction data, with explicit paid/confirmed status and date definitions. |
| Attendee table and manual attendance marking | 45–75 min | Name, ticket quantity and total paid are already projected; add owned attendance recording. Feature 1 uses attendance when validating a review. |
| Connect event management and public organizer/rating links | 30–45 min | Reuse feature 1's event creation/edit screens and rating summary rather than reimplementing them. A real public organizer profile exposes safe fields. |
| Confirmations, empty/loading/error states and regression | 45–60 min | Responsive pages, relevant modification confirmation dialogs and realistic multi-user data. Recheck both roles. |
| **Total** | **3–4½ h** | Companion note explains aggregate queries, ownership joins and registration versus attendance. |

## Thursday, 5 November — evaluator-ready release

| Subtask | Time | Checkpoint / why it matters |
| --- | --- | --- |
| Deploy browser/API and configure private environment | 60–90 min | Evaluator can open a working HTTPS application. Preserve same-origin auth routing, verified database TLS and worker execution. Configure trusted proxy/source-IP handling and test rate limits; prepare usable demo accounts linked to the sample data. |
| CI, health checks, logs and scheduled executor | 30–60 min | Automate typecheck/test/build; expose a safe health check; make failures diagnosable. The scheduled worker must actually run outside a developer's terminal. |
| Full journeys and requirement audit | 60–90 min | Register with referral → rewards → purchase → upload → approve/reject/expire → verify seats/rewards/emails/attendees and attendance-gated review. Include manual browser checks and both roles. |
| Independent run guide, submission evidence and presentation Q&A | 45–60 min | Fresh install/run instructions, feature ownership, environment template, demo access, known limits and explanation without cue notes. |
| **Total** | **3¼–5 h** | The final release is demonstrable, reproducible and evaluated against the PRD. |

Existing seed identities have no password. They are not usable evaluator logins until an explicit demo-account setup is prepared. Keep passwords/connection credentials out of public notes; do not casually reset shared seed users. Ensure the dashboard demo account actually owns the events behind the 30 purchases.

## Time and completion conditions

The five days above total approximately **17–26 focused hours**. Reserve an additional **3–6 hours** for cross-feature integration, provider setup, bug fixes and manual browser regression, spread where needed or on Friday, 6 November. Stop and explain a blocking dependency rather than marking a stub complete.

| Required area | Completion condition |
| --- | --- |
| Authentication | Register/login; customer and organizer roles; backend permissions plus protected pages; unique immutable referral codes; no exposed credential data. |
| Referral rewards | Incoming referral records; coupon to the referred user; 10,000 points to the referrer; three-month grant/coupon expiry; no duplicate issuance. |
| Profile | Both roles can edit their own supported profile fields, upload a picture, change password and recover a forgotten password. |
| Organizer management | Own events accessible for management; transactions/proofs visible only to their organizer; valid accept/reject; notification emails. |
| Restoration | Applicable seats, event vouchers, platform coupons and points restored exactly once using the shared engine; deadline races covered. |
| Reporting | Day/month/year charts from real owned data; attendee name, quantity and total paid; actual attendance separate from registration. |
| Shared requirements | Responsive screens, confirmation dialogs, useful empty/error states, tests for each flow and SQL transactions for coupled changes. |
| Submission | Working evaluator URL, standalone feature 2 instructions, partner adapters/seed data where necessary, complete combined-flow proof and clear ownership. |

Feature 1 retains event discovery/creation, checkout/payment-proof workflows, event vouchers, timeouts and reviews. Feature 2 supplies identity/rewards and organizer operations. The purchase and reward records need one consistent authority in the integrated application.

Redis/BullMQ, QR scanning, Socket.IO, PWA and an additional serverless deployment are optional unless the lecturer separately requires them. SSR/SEO mostly connect to feature 1's public event pages. Docker, CI/CD and monitoring are shared delivery work that Wili can own; they are not a substitute for completing the feature 2 business flows.
