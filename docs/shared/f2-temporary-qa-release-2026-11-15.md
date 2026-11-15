# Temporary F2 connection — QA release, 15 November 2026

- **Live QA:** https://temuevent-combined-qa-andor2.vercel.app
- **Application source:** `d300edd2136d313719cc657dc236f78c1400f2e5`
- **Preview deployment:** `dpl_AXfoXCbFeQYXu2HsUWcWgAaTMU1W` — READY
- **Branch / PR:** `f2/temporary-purchase-proof-20261115`, [PR #98](https://github.com/wilisail/event-management-platform-pwdk/pull/98) targeting `integration`.

The canonical QA alias was switched after hosted verification and temporary-data cleanup. Its health and readiness endpoints return 200; checkout, sessions, private proofs, Organizer decisions and purchase deadlines are configured. The orders page also returns 200. No error/fatal runtime logs were found in the checked 30-minute window. Preview protection remains enabled. This is a QA release from the temporary branch; it does not merge the PR or promote production.

The temporary connection supports a fresh saved purchase → proof → approval/rejection → participant/wallet/notification → direct review journey. The previous preview-only checkout could show a transaction without creating purchase/proof records, which prevented a fresh end-to-end F2 evaluation. Both references to a blocked fresh purchase journey described that same missing connection. The new QA build supplies it. This finding describes the checked source behavior and makes no claim about another contributor's progress.

## Verification and evaluation status

| Area | Result and practical limit |
| --- | --- |
| Saved purchase and points | Fresh hosted Rp50,000 purchase reserved 5,000 real points and persisted Rp45,000 payable. Reload/read and same-identity retry returned the same order. Approval consumed the existing reservation once. |
| Private proof | A real PNG was normalized to JPEG and stored/read privately. Signed-out, Customer-at-Organizer-route and foreign-Organizer access were refused. Invalid bytes were refused; CSRF and customer ownership checks passed. |
| Normal Organizer decisions | Real ACCEPT and REJECT each succeeded once; duplicate decisions returned 409. Confirmed participants and revenue follow DONE purchases. Rejection restored the coupon and ticket seat. |
| Referral and coupon | A fresh referred signup produced exactly 10,000 referrer points and one Rp25,000 newcomer coupon. The coupon was reserved/restored through rejection and cancellation. |
| Deadlines | Only two temporary test orders were made overdue. The existing hosted scheduled worker transitioned them to EXPIRED and CANCELED, restoring their points/coupon/seats. No two-hour or three-day wait is needed during the owner tour. |
| Free/fully discounted | A Rp10,000 ticket covered by the referral coupon became DONE at Rp0, did not request proof and appeared as a confirmed participant. |
| Event feedback | Two fresh hosted reviews saved with attendance false and true while the event had zero Organizer attendance records. Duplicate review was refused. The review page opens directly without selecting tickets. |
| Email | The normal outbox shows two ACCEPTED Gmail deliveries, one for each Organizer decision. They used temporary aliases of the owner's established test inbox. Transport acceptance does not establish actual inbox receipt. |
| Responsive browser regression | [Integration CI](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/43697723895) passed the browser → actual disposable runtime/database journey at 1280/360/320 px. Purchase/proof survive reload, approval updates participants and direct feedback saves. A lost-response retry creates exactly one purchase. These screenshots use isolated data, separately from the hosted API/provider checks. |
| Automated source checks | [Feature 2 CI](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/43697723880) and Integration CI passed on the deployed application commit: 168 F2 tests, seven integration tests, eight new checkout runtime groups, nine existing final-B groups, migration/lifecycle regressions, typechecks and production builds. |
| Owner evaluation | **Pending.** Run the [ordered 35–50 minute UX tour](f2-qa-evaluation-tour-2026-11-15.md). It includes creation/image, discovery/roles, a new referral, paid checkout/proof, approval/review, rejection/coupon, logout/evaluator access and password recovery last. Automated checks do not establish the owner's acceptance or a guaranteed rubric score. |

## Data cleanup and release safety

Four temporary accounts, one event, five purchases and two reviews were removed after verification. All three physical private test-proof objects were deleted through the Storage API. A narrowly bounded one-off cleanup helper was immediately retired to an inert JWT-protected 410 response. No active temporary alias share entry remained after verification, and local test credentials were removed.

A guarded database transaction checked the exact QA identities/event, terminal order states, notification acceptance and absence of remaining proof objects before deletion. It also required the complete original-table counts and full-row fingerprints to match the pre-test baseline, otherwise the cleanup would roll back. All eleven tables matched: the original 12 users, 17 events, 24 ticket types, 35 purchases/items, reward records, three reviews and one attendance record remain unchanged. Original passwords, accepted decisions and the saved four-star review were preserved.

[Sanitized machine-readable release evidence](evidence/f2-temporary-qa-release-2026-11-15.json) records statuses, provider acceptance, cleanup and baseline matching. The manual hosted runner is `database/scripts/verify-temporary-checkout-hosted.py`; it requires a private scoped configuration and is not part of automatic CI. Do not rerun its signup/payment mutations against accepted owner records.

## Boundaries and recurrence prevention

| Boundary | Owner action or dependency |
| --- | --- |
| Event creation/poster | Existing publishing and Cloudinary integration are retained. Recheck a new image through the actual browser form/reload during the tour. The hosted API test did not create a new Cloudinary asset. |
| Event-specific vouchers | Separate from F2 referral coupons and unsupported by this temporary connection. Full event-voucher evaluation remains outstanding. |
| Event edit/delete/draft management | Separate event-management acceptance. Changes must preserve purchase/seat accounting and ownership. |
| Preview/evaluator access | Confirm the evaluator can open the intended release using their own authorized access. Owner access alone is insufficient evidence. |
| Replacement | Keep the temporary connection within F2 until a compatible shared implementation passes the contract/journey checks and is deliberately selected. Preserve saved purchase/proof identities and remove the old binding when switching. |

The confusing review/purchase screen was a flow and navigation issue: public event details legitimately include buying controls, including when an Organizer opens the public view, but feedback needs its own direct entry and task-specific page. Optional self-reported attendance replaces the earlier attendance gate. Role/public-view labels, direct feedback navigation, the current flow/dependency checklist and browser/database regressions now cover these rules. A successful compile alone cannot check them.

For future changes, compare the affected role → entry → action → saved state against [current UX acceptance](current-ux-acceptance.md), identify simulated routes, and run the relevant actual runtime/browser checks before asking the owner to repeat one coherent screen tour. This combines fast automated persistence/security checks with owner judgment about wording and layout; it does not add a separate build phase.

Rollback, if a newly observed hosted defect requires it: reassign only the combined QA alias to previous deployment `dpl_4XaF9xYxbgHdSkVbN3qTQniuwjKb`. Do not reset the database, repeat accepted decisions or alter the existing scheduled worker.
