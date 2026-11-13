# Final PRD pass — B: live F2 transaction connections

Prepared 13 November 2026, Asia/Jakarta. The [A–F progress record](final-prd-completion-progress.md) is the current status authority. This companion explains the bounded B implementation; positive hosted purchases and owner acceptance remain C/D.

## Behavior and mechanics

Normal F2 startup now binds the private payment-proof reader and Organizer decision transition to the existing shared database. Both the combined app and the standalone F2 app use this runtime. The Organizer's existing proof/accept/reject controls use these bindings; no checkout or proof-upload UI is introduced.

The private proof adapter uses the existing backend-only Supabase settings and a separate `payment-proofs` bucket. It requires a private bucket, a maximum 5 MiB object size, and PNG/JPEG restrictions. The reader repeats event ownership before requesting the recorded object; bytes are returned through the existing protected endpoint with private/no-store, restrictive content headers and image-signature checks. URLs and object keys are not returned to the browser.

The shared transition first locks the Customer's reward account, then rechecks the purchase and Organizer ownership under a purchase lock. It reads the database clock after lock waits and checks the persisted deadline. Approval sets DONE and consumes the matching reward reservation. Rejection/expiry/cancellation restores original point allocations and releases the referral coupon through the existing reward core, and restores the reserved ticket quantities with capacity guards. A decision's queued email is written inside that same SQL transaction. An accounting or outbox failure rolls everything back; delivery runs afterward.

The existing secret-protected scheduled endpoint now scans a bounded batch of overdue purchases before processing the recovery/decision email queues. The existing minute executor is reused. Overdue WAITING_FOR_PAYMENT becomes EXPIRED; overdue WAITING_FOR_ADMIN_CONFIRMATION becomes CANCELED. Repeated/concurrent requests recheck the locked terminal state and cannot restore twice. The long-running standalone Node executor also invokes the deadline dispatcher.

`F2_PURCHASE_DEADLINE_START_AT` is an optional persisted activation cutoff. Preview uses 13 November 2026 00:00 UTC to preserve the ten intentionally historical pending October demo purchases. New operational purchases are included. An empty setting in a fresh environment processes all overdue purchases; never derive the cutoff from each process's startup time.

## Verification boundaries

The new disposable SQL/runtime runner starts **createRuntime**, real database-backed sessions, the production decision adapter and the authorized job endpoint. It does not import the Round 5 QA transition adapter. It verifies proof/ownership/role checks; persisted approval/rejection and exactly-once accounting; captured-mail retry; real deadline execution and the historical cutoff; atomic rollback on an actual SQL outbox failure; competing decisions; and safe handling of inconsistent inventory/unsupported event vouchers.

The private storage adapter has separate provider-contract tests for project origin, server authorization, private/size/MIME restrictions, object-key traversal, provider errors and oversized objects. Scheduler tests cover authorization, ordering and visible deadline failure without blocking existing queue processing.

[Sanitized isolated evidence](evidence/final-b-runtime-isolated-2026-11-13.json) records nine scenario groups and nine replayed migrations. Memory file/mail transports are explicit. Hosted bucket/runtime/worker verification and final source PR/CI links are recorded in the A–F progress checkpoint after release. No owner inbox receipt, positive browser acceptance or actual F1 checkout completion is inferred from these tests. Disposable concurrent requests use one physical PostgreSQL connection; independent-session stress testing remains outside this bounded pass.

## Remaining F1 boundary

The shared purchase projection has no event-voucher reservation identity or quota mapping. A nonzero **event-voucher** discount therefore fails the transition atomically until F1 supplies that adapter; no voucher restoration is fabricated. F2's **referral reward coupons and points** are supported. F1 retains purchase creation/items/seat reservation, proof upload, event edit/delete and voucher/draft implementation. C can prepare controlled purchases conforming to the existing contract, with a zero event-voucher discount.

## Reproduce

Install the locked F2/database dependencies, generate the F2 Prisma client and run:

```sh
cd database
npm run qa:final-b
```

This runner creates a disposable local PostgreSQL engine and never reads a shared connection URL. Both F2 and Integration CI include it. Existing Rounds 5/6 coverage remains enabled in the appropriate standalone/combined workflows.
