# Day 6 automated follow-up and operations

Updated 6 November 2026, Asia/Jakarta. The interrupted turn completed the hosted checks but stopped before temporary QA cleanup and the final reusable handoff. This follow-up closes those automated tasks. It does not mark the combined F1/F2 purchase journey complete.

## Verified result

| Area | Evidence |
| --- | --- |
| CI | [PR #40](https://github.com/wilisail/event-management-platform-pwdk/pull/40) contains the complete F2 snapshot. [Run 42170565389](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/42170565389) passed typecheck, 144 application tests, nine disposable migration replays, the organizer/worker harness, and the hosted-mode build on Node 22. |
| Node 22 fix | Commit `64e72b942e5e1447efdc46352f17d08250fb92aa` loads the TypeScript test dependencies through CommonJS. The earlier failing import was a harness compatibility problem; the subsequent full run passed. |
| Hosted API | Thirteen build-time checks passed against the protected [F2 Preview](https://temuevent-8jbtjn050-andor2.vercel.app/login): login for a customer and two organizers, secure cookies, role and ownership denial, owned purchase reads, three statistics groupings, attendance/CSRF, logout, worker authorization and persisted queue progress. |
| Database | All nine Prisma migration records are finished, not rolled back, and match the committed SQL checksums. Attendance and organizer-decision outbox tables are applied; their RLS and backend permissions were checked. The nullable Cloudinary poster ID is present. |
| Scheduled executor | `temuevent-preview-email-jobs` is active at `* * * * *`. The last five inspected responses were HTTP 200 with both queues enabled. The command reads credentials from Vault. This schedules email work; F1 purchase expiry remains a separate integration responsibility. |
| Live cleanup | Removed the exact three disposable QA identities, event, ticket type, purchase, item and attendance row, plus five sessions and five refresh tokens. Every targeted remaining count is zero. Unexpected references abort the entire cleanup. |
| Reusable checks | The new operations tests cover read-only inspection, identity validation, rollback on an unrelated purchase, removal of dependent sessions/tokens, repeat cleanup, migration checksum drift and output redaction. |

The persisted queue test used a nonexistent `example.test` recipient and reached `SUPPRESSED` once. It proves durable worker progress without sending email. Real inbox receipt is a separate acceptance check.

## Reuse the operations script

Use the reviewed `day6-feature-2-ci` branch from PR #40 and install the database dependencies with `cd database && npm ci`. The [script](https://github.com/wilisail/event-management-platform-pwdk/blob/day6-feature-2-ci/database/scripts/day6-ops.mjs) needs Node 22.12+.

```sh
node scripts/day6-ops.mjs status --sql
node scripts/day6-ops.mjs cleanup --fixtures /private/qa.json --sql
node scripts/day6-ops.mjs cleanup --fixtures /private/qa.json --apply --sql
node --test scripts/day6-ops.test.mjs
```

`status` emits a read-only query for migration checksums, RLS, Cron metadata and recent sanitized worker responses. `cleanup` defaults to read-only counts. Only `--apply` emits the bounded deletion block. Run generated SQL through the authorized Supabase SQL connection, then run status and cleanup counts again.

For direct execution, replace `--sql` with `--execute` and provide the private `F2_OPS_DATABASE_URL` in the shell environment. It must target this TemuEvent project's `temuevent` schema; TLS uses the committed public Supabase CA with verification enabled. The runtime app role lacks cleanup permissions; use the authorized operations/owner connection. Do not put connection strings or fixture credentials in Git.

The private fixture manifest supplies `users` in customer / owning organizer / other organizer order, plus `eventId`, `ticketId`, `purchaseId` and `itemId`. Each user has an explicit UUID, a `day6-…@example.test` address and role. Existing passwords are discarded. The event slug must be `day6-qa-<eventId>` and purchase reference `DAY6-QA-<purchaseId>`. Any unexpected review/reward/foreign purchase reference makes PostgreSQL roll back the operation; extend the reviewed fixture contract before retrying.

The script does not apply migrations, change schedules, send mail, invoke a worker or deploy code. An old HTTP response is not fresh evidence: inspect the newest response's `fresh` flag and timestamp. The older four history entries naturally age as time passes.

## Remaining acceptance checks

| Owner | Remaining step |
| --- | --- |
| Wili / inbox owner | Confirm the actual reset email arrives and open its single-use link. Provider acceptance, queue progress and HTTP 200 do not establish inbox delivery. |
| Wili / evaluator | Confirm the evaluator can open the protected Preview and sign in using the intended demo identities. Disposable QA credentials have been retired. |
| F1 + integrator | Connect the real checkout, private proof access, shared purchase/reward transition, voucher restoration, timeout races and session-bound attendance-gated reviews. Then run the combined Preview journey. |

[Sanitized evidence](evidence/day-6-automated-2026-11-06.json) · [Current schedule](feature-2-completion-plan.md) · [CI and worker](day-6-ci-worker-reference.md)
