# Day 4 Part 4 — Isolated verification and integration handoff

Updated 4 November 2026. All **138 existing Feature 2 tests passed**. A separate verifier replayed **all seven SQL migrations** on a fresh, in-memory PGlite PostgreSQL database and ran the actual F2 Express and Prisma code as the restricted `temuevent_app` role. Test accounts, purchases and messages are synthetic. The verifier uses a test-only transition for purchase status and outbox writes, a controlled session fixture, and a fake Resend transport. It never reads a hosted database connection string or sends real mail.

| Area | Verified locally |
| --- | --- |
| 4.1 Transaction list/detail | Six purchase statuses and a status filter; an organizer sees only purchases for owned events; a customer is denied; a foreign organizer's detail request is denied. Ticket and deduction amounts are read from PostgreSQL. The response includes the upload timestamp while omitting the private key and buyer email. |
| 4.2 Decision boundary | A customer or another organizer cannot decide. CSRF must match the session, and caller-supplied actor fields are rejected. A decision at the exact deadline is closed. A deadline crossed after the initial read is also refused by the test adapter. With the adapter absent, an eligible request fails closed. With it present, approval/rejection persist their respective statuses and a replay does not write again. |
| 4.3 Decision outbox | The migration and private permissions replayed. A rollback removes both the test decision and its email job, duplicate enqueue keeps one job, and an autocommit call is rejected. The worker preserves payload and key on retry, stops after three transient failures, fails on a permanent rejection, and recovers an abandoned lease without letting its old owner overwrite the new claim. |

## Repeat the isolated check

Use the local Feature 2 checkout with its dependencies installed and Prisma Client generated. The verifier is `database/scripts/verify-day4-isolated.mjs`. Install the two isolated database packages without changing manifests if the local database workspace does not already have them.

```bash
cd database
npm install --no-save --package-lock=false @electric-sql/pglite@0.4.3 @electric-sql/pglite-socket@0.1.3
node --import tsx scripts/verify-day4-isolated.mjs
```

Expected result: `DAY4_ISOLATED_OK: 7 migrations; restricted-role HTTP, rollback, retries and lease fencing`.

## Day 6–7 integration gates

1. Run a real F1 checkout and upload a test proof. Confirm the owning organizer can open the actual file and a second organizer cannot. The isolated check covers the metadata and transaction access, not private file delivery.
2. Connect F1's shared transition. Use two independent PostgreSQL sessions for rejection versus timeout and repeated requests. Verify final purchase state, seat counts, voucher quota, coupon and point allocations, and exactly one outbox job where appropriate. The test adapter does not implement F1 stock or reward effects. The local PGlite run uses one database connection and exercises boundary and lease behavior, not a true multi-connection race.
3. Replay the customer-to-organizer browser journey in the combined app. Confirm the buyer sees the same final status and that a hosted executor processes the queued email. Verify actual receipt in a controlled inbox. The shared database migration, hosted executor, and real email delivery have not been exercised by this checkpoint.

**Learning checkpoint.** Passing a guarded HTTP request proves the correct actor can ask for a decision. A database rollback proves the test decision and email intent commit together. A two-connection test on the actual shared engine is what proves two competing transitions cannot both restore the same resources. Keep those three claims separate when presenting the work.

See the [work schedule](feature-2-completion-plan.md) and the [outbox companion](organizer-decision-email-reference.md).
