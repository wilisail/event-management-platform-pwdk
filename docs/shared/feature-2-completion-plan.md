# Feature 2 — remaining implementation plan

Prepared: 31 October 2026, Asia/Jakarta. These are focused working-time estimates including implementation, relevant checks and companion explanations. They are planning ranges, not scheduled automations or promises of elapsed delivery time. Adjust the pace when a foundation needs more explanation.

2 November shared integration checkpoint: Rizky's review storage is applied and mirrored in the shared/F2 Prisma schemas; see the [review schema companion](review-schema-reference.md). This does not complete Day 4 decisions or Day 5 attendance/review API wiring.

Progress, 1 November: day 2 subparts 1–4 and day 3 subparts 1, 2 and 4 are complete. The reward schema, atomic signup/issuance, authenticated wallet/referral API/UI and shared reserve/consume/restore core are implemented on feature-2. See the [schema](referral-reward-schema-reference.md), [signup](referral-registration-reference.md), [wallet](wallet-reference.md) and [reward-operation](reward-operations-reference.md) notes. The real feature 1 checkout/transition adapters and combined-flow tests remain integration work. Day 3 subpart 3 recovery implementation and companion are ready with 136 tests, real Supabase rollback checks, eight isolated PostgreSQL races, browser checks and a real protected HTTPS/Resend/Supabase flow. Final actual inbox receipt/use and owner-role Prisma-ledger reconciliation remain explicit checks; see the [recovery/email companion](password-reset-reference.md). Day 3 subpart 4 regression/learning review is complete: 138 tests, real rollback-only combined account journeys, four responsive browser cases and a cross-tab stale-edit fix pass. See the [account regression/learning companion](account-regression-reference.md). The next build section is Day 4 organizer decisions; part 3 real-inbox confirmation remains separately pending.

Day 3 part 1 was brought forward and completed: own-name editing, real public organizer identity and photo upload/processing/storage are implemented. Real Supabase checks passed for upload, read, replacement, old-file cleanup, ownership/CSRF and customer/organizer visibility. The private bucket is configured; all test records/files were removed. TypeScript, 114 tests and the production build pass. See the [profile companion and Day 3–6 dependency map](profile-upload-reference.md). Day 3 is Monday's account section below; Day 4 is Tuesday's organizer-decision section, Day 5 Wednesday's dashboard and Day 6 Thursday's release.

## Starting point after today

Day 3 part 2 is complete: both roles can change their password after current-password verification and confirmation. The hash update and all-session revocation commit atomically; concurrent login creation rechecks its password proof under the same user lock. TypeScript, 125 tests, a clean production build, real Supabase rollback checks, six isolated PostgreSQL race scenarios and desktop/phone browser checks pass. See the [password-change companion](password-change-reference.md). Password recovery/email implementation is ready in part 3; its final inbox check is still pending.

Implemented on `feature-2`: real registration, password hashing, persisted sessions/refresh rotation/logout, role/ownership guards, protected identity/event/confirmed-attendee APIs, and their connected account/login/organizer frontend. The shared PostgreSQL/Prisma starter and 30 sample purchases already exist. See the [frontend authentication checkpoint](frontend-authentication-reference.md).

Not complete: production checkout/transition wiring to the implemented reward core; final recovery inbox confirmation; organizer decisions/notification emails/statistics; attendance recording; Feature 1 event-page links/rating integration; final combined testing/deployment. Incoming referral signup/issuance, own-name/photo editing with real private Storage, known-password change/all-session revocation and real public organizer identity are implemented. Fixture pages and sample rows do not count as finished business flows.

The latest scoring is authentication/authorization **4**, referrals/profile/rewards **4**, organizer dashboard **2**. Completion means satisfying every required behavior, not merely obtaining the largest scoring items.

## Days 1–7: built work and remaining verification

Updated 4 November. The table tracks carryover within the existing schedule. **Built locally** means the Feature 2 code is in the working checkout. It still needs the listed runtime or integration checks. Finish cross-feature checks when both sides are ready, with Day 6 for the release journey and Day 7 for anything still pending. Count each shared check once.

| Part | Current checkpoint | Remaining check or dependency |
| --- | --- | --- |
| 1.1 Registration and 1.2 sessions | Database-backed registration, login, refresh rotation and logout are built. Earlier checks are in the [registration](registration-reference.md) and [session](login-session-reference.md) notes. | Day 6–7: verify the combined deployment uses the same account/session authority and checkout resumes through an approved route after login. |
| 1.3 Guards and 1.4 frontend | Roles, ownership, CSRF, account pages and organizer event/attendee reads are built. Earlier checks are in the [authorization](authorization-reference.md) and [frontend](frontend-authentication-reference.md) notes. | Day 6–7: exercise both roles and two organizers across the combined app, including expired sessions and direct API access. |
| 2.1 Reward schema, 2.2 referral issuance, 2.3 wallet | Built and checked as F2 foundations. | Day 6–7: check the combined signup and checkout journey uses the recorded wallet balances, coupon values and expiry. |
| 2.4 Reward operations | Reserve, consume and restore are implemented in a caller-owned SQL transaction. | F1 checkout and the shared transition must call this core. Day 4.4/6–7 checks the real reservation, deduction and exactly-once restoration. |
| 3.1 Profile and 3.2 password change | Built. Hosted profile storage and password/session checks are recorded in their companion notes. | Recheck the roles on the evaluator URL in Day 6. Private payment proofs in 4.1 use a separate access contract. |
| 3.3 Password recovery | Built. Protected Preview reached Resend's simulated recipient. | Owner inbox receipt and opening the actual reset link are still pending. This can be done before Day 6 and does not depend on F1. Resolve the migration ledger with the owner role before any affected migration deploy. |
| 3.4 Account regression | Standalone F2 regression recorded as passed. | Day 6–7: rerun the key account flows in the final combined environment. |
| 4.1 Organizer transaction reads | [Built locally](organizer-transactions-reference.md). Isolated HTTP checks passed for owner-scoped lists/details, all six statuses, and private proof metadata. | F1 private proof interface and a real test upload. Allow **5–10 min** to connect and **10–20 min** for the owning organizer/other organizer file-access check once ready. Use the Day 7 buffer if not ready in Day 6. |
| 4.2 Approve/reject | [F2 boundary and controls built locally](organizer-decision-reference.md). Isolated HTTP checks passed for role, ownership, CSRF, deadlines, and approval/rejection through a test-only transition. | Wire the F1/shared engine and check its behavior against real checkout, proof, seat, voucher and reward records. Verify proof viewing before enabling the integrated flow. |
| 4.3 Decision emails | [Outbox and worker built locally](organizer-decision-email-reference.md). Isolated migration replay, rollback, deduplication, retries and stale lease checks passed. | Wire enqueue into the actual shared transition. Verify a live decision triggers one email in a controlled inbox. Day 6 supplies the hosted executor. |
| 4.4 Combined decision checks | [Local verification passed](organizer-day4-verification-reference.md). All seven SQL migrations replayed, and all 138 existing F2 tests passed. | Day 6–7: run the F1 browser checkout through real proof and approval/rejection/expiry, including two independent database sessions contending for the transition. Confirm the customer-facing status, exactly-once restoration, and actual inbox delivery. |
| 5.1 Organizer statistics | [Built locally and checked against an isolated database](organizer-statistics-reference.md). Daily, monthly and yearly reports use owned `DONE` purchases, final amounts and WIB completion dates. | Day 5.4: desktop/phone charts, filters and loading/empty/error states. Day 6–7: verify F1 persists final totals, quantities and `completedAt`, then compare the Preview report with a real test checkout. No new service or migration for 5.1. |
| 5.2 Attendees and attendance | [Manual attendance marking built locally and verified in isolation](organizer-attendance-reference.md). One attendance record per event/customer, separate from confirmed purchases. | Apply the replayed attendance migration in the intended non-production database before hosting this code. Day 5.4: check the confirmation and mobile table. Day 6–7: check the owning organizer's action in Preview and wire F1's review eligibility to the attendance lookup. |
| 5.3 Event management and ratings, 5.4 dashboard checks | Planned. | Link the real F1 screens/aggregates and check loading, empty, error and confirmation states on desktop and phone. |
| 6.1 Deploy, 6.2 checks and executor | Release work remains. A protected account Preview exists. | Verify evaluator access, environment scope, demo identities, CI and a hosted executor that actually processes due work. |
| 6.3 Full journeys, 6.4 submission | Planned. | Collect combined browser/API evidence and a reproducible run guide. Separate any pending provider or partner checks from verified results. |
| 7 Integration buffer | **3–6 focused hours** already allocated. | Complete outstanding F1 checkout/session, proof and decision wiring and the combined verification above. Include event image compatibility only if Rizky's public poster contract requires it. |

### Platform checks before hosted verification

These checks belong to the existing parts above. Keep them separate from the status of the local code and count each check once.

| Days | What to confirm in the target environment |
| --- | --- |
| 1–2 | Reuse the shared PostgreSQL schema and backend role. Verify the combined session and API routing in Preview with working demo accounts. Align F1 reward calls with the existing shared transaction contract. |
| 3 | Verify private profile storage against the correct test project. Keep Resend credentials server-side and confirm the password reset email in the account owner's inbox. Reuse the current configuration if it works. |
| 4 | Confirm Preview scopes and the intended database. Align F1 proof access and the shared transition, then apply the verified outbox migration with the authorized migration role in the target environment. Verify receipt, retries and a real expiry/decision race separately from the isolated evidence. |
| 5 | Statistics uses existing purchase tables. Verify `completedAt` represents the actual completion instant and the report counts the same purchases as the combined app. Attendance and F1 management/review links have their own database and interface checks. |
| 6–7 | Set up the evaluator deployment, approved routing and demo accounts. Verify the migration ledger, scheduled executor, protected assets and real email delivery. Run a combined browser journey before marking the release complete. |

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
