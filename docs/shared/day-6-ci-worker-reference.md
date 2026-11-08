# Day 6 Part 2 — CI and scheduled email worker

Updated 6 November 2026, Asia/Jakarta. The CI branch is published, its full Node 22 workflow is green, and the email schedule is active in Preview.

## CI evidence

The reviewed snapshot from `day6-feature-2-ci` was merged into `feature-2` through [PR #40](https://github.com/wilisail/event-management-platform-pwdk/pull/40) on 8 November, at `541839b`. [Run 42178273975](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/42178273975) passed dependency installation, TypeScript, all 144 application tests, nine SQL migration replays and organizer/worker/attendance checks against a disposable database, then the production build in hosted mode. See the [Day 7 companion](day-7-event-poster-integration-reference.md) for the next incremental integration and deferred live checks.

An earlier run passed typecheck and 144 tests but failed at the disposable harness's Node 22 import boundary. Commit `64e72b9` corrected CommonJS loading; the subsequent full run passed. The same full run also passed both new operations regression tests for the reusable status/cleanup script. They need no project secrets or live database.

## Hosted execution

| Boundary | Verified behavior |
| --- | --- |
| Readiness | `GET /api/ready` returns a safe readiness boolean and no-store headers; it is not a migration ledger check. |
| Worker authorization | `POST /api/internal/jobs/run` rejects a missing bearer token and query injection. The dedicated secret authorizes both configured email queues. Vercel protection has its separate bypass boundary. |
| Scheduler | Supabase job `temuevent-preview-email-jobs`, active every minute, targets `https://temuevent-8jbtjn050-andor2.vercel.app/api/internal/jobs/run`. Secrets stay in Vault. |
| HTTP result | Five consecutive inspected scheduled responses were HTTP 200, `success: true`, `passwordReset: true`, `decisionEmails: true`. Cron's SQL submission result and the HTTP result were checked separately. |
| Durable progress | A disposable nonexistent-recipient job was claimed once and persisted as SUPPRESSED. It was removed after verification. This test sent no mail. |
| Cleanup | All exact hosted QA fixture counts are zero. The worker schedule remains active. |

Real inbox receipt remains unconfirmed. The combined purchase/decision path must enqueue its notification inside the shared transition before a real decision-triggered email can be accepted.

The schedule handles password-reset and organizer-decision email retries. It does not implement F1's two-hour purchase expiry or three-day organizer timeout. Those must use the shared purchase/reward transition.

## Operating changes

Use the [operations script](https://github.com/wilisail/event-management-platform-pwdk/blob/day6-feature-2-ci/database/scripts/day6-ops.mjs) and [companion](day-6-operations-reference.md) for fresh status. If the app Preview is replaced, update the scheduler target and recheck the new protected endpoint, HTTP response and persisted queue outcome together. Keep the app bearer secret and Vercel bypass secret separate and out of SQL output/logs.

[Preview state](day-6-preview-deployment-reference.md) · [Sanitized evidence](evidence/day-6-automated-2026-11-06.json) · [Current schedule](feature-2-completion-plan.md)
