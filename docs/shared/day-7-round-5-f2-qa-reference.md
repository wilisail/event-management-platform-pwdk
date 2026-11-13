# Day 7 — Round 5 independent F2 QA

Updated 11 November 2026, Asia/Jakarta. The independent automated portion passed. Owner browser/inbox acceptance is deliberately scheduled after the build/test phase. The complete F1 customer purchase journey remains open.

## Implemented and checked

| Area | Result |
| --- | --- |
| Organizer private proof interface | Session/role/ownership-protected binary GET endpoint; the file reader repeats the database owner predicate. PNG/JPEG only, at most 5 MiB, signature validation, fixed safe filename, no public/signed URL or storage key in JSON, restrictive browser headers and no-store delivery. |
| Organizer UI | Offers **Lihat bukti pembayaran** when its private reader is connected. Missing reader/upload/file stays unavailable or returns a safe error. |
| Controlled decisions | Disposable QA adapter calls the real F2 reward and durable-email services inside the purchase transaction. Approval consumes once; rejection, payment expiry and Organizer cancellation restore seats/rewards once. |
| Failure and repeat requests | Denied role/owner/CSRF attempts leave data unchanged. Failure before commit rolls back accounting and outbox. A lost response after commit produces an uncertain result; fresh reads/repeat requests show one committed outcome. Concurrent HTTP accept/reject attempts yield one success and one closed result. |
| Deadlines and rewards | Two-hour payment expiry, three-day Organizer deadline and exact-boundary denial use a controlled clock. Restoration preserves original earning-batch/coupon expiry; expired rewards remain unspendable. |
| Email | Real durable F2 worker processes five decision jobs, captures six attempts including one retry, preserves payload/idempotency key and sends no external mail. |
| Downstream reads | The approved purchase appears in owner-scoped attendee and Rp70,000 revenue queries; buyer wallet reflects consumed/restored rewards. |

[Sanitized automated evidence](evidence/day-7-round-5-f2-isolated-2026-11-11.json)

The new QA runner replays nine migrations in disposable PGlite/Postgres, uses the restricted application role, and exercises eleven purchase scenarios. It never loads a project connection string, shared Storage or SMTP credentials. The QA transition and review-tool modules are outside application bootstraps. The ordinary app exposes neither QA persona selection nor a captured mailbox. No shared account, purchase, poster or Round 4A/4B record was changed.

## Reproduce the automated portion

Use the locked root, F2 and database dependencies, then run from the repository root:

```sh
npm run db:generate
npm --prefix database run qa:round5 -- --report /tmp/temuevent-round5-evidence.json
```

The command typechecks the QA adapters, creates fresh isolated fixtures, runs the API/database/worker checks, closes the database and atomically writes its report. It needs no login, approval window, real payment or inbox owner. Integration CI includes the command. The F2 application tests, six combined HTTP tests, both app typechecks and both production builds were checked separately.

## Owner attention comes last

| Stage | Operator work | Owner attention |
| --- | --- | --- |
| Build and automated QA | Implement adapters, run security/accounting/failure cases, verify builds and save evidence/checkpoint | None |
| Optional isolated UI review | Start the disposable API/review server and the existing F2 web UI; verify reachability before handing off | One short window: open proof, accept one fixture, reject another, inspect both buyer outcomes and captured messages |
| Live acceptance | Bind F1 purchase/proof/transition services and provide verified hosted links | Confirm the real browser journey and actual inbox receipt together |

The optional loopback review tooling can be started in two terminals:

```sh
npm --prefix database run qa:round5 -- --serve --report /tmp/temuevent-round5-review.json
```

```sh
F2_API_ORIGIN=http://127.0.0.1:4405 F2_HOSTED_API=false node feature-2/node_modules/next/dist/bin/next dev feature-2 --hostname 127.0.0.1 --port 3305
```

On that same host, the review hub is `http://127.0.0.1:4405/qa` and the actual F2 Organizer UI is `http://127.0.0.1:3305/organizer`. The review launcher selects only disposable fixture identities; it asks for no real account password. Its cross-origin guard and owner/buyer row isolation passed API bootstrap checks. Two extra unprocessed fixture purchases are reserved for owner clicks. Emails are captured locally. Stop with Ctrl+C; restarting recreates only isolated data.

**Reachability limit:** the current cloud browser could not reach the local review server. No visual acceptance, usable public QA URL or actual inbox receipt is claimed. These remain pending; the owner should not stand by until a reachable review is verified. A localhost address is useful only on the host running these processes.

## Interruption and final live boundary

Save the successful report, source commit and remaining owner checklist before requesting any publication/merge approval. Resume from that checkpoint; never replay already-completed writes against real accounts to recover an interrupted session. The isolated runner is safe to rerun because each invocation starts a new disposable database and uses no shared credentials.

The normal hosted runtime still has no F1 purchase-transition/private-proof storage binding. This work supplies the F2 private-proof interface and isolated QA evidence; it does not silently enable the QA engine on the shared Preview. F1 customer purchase/proof pages, buyer private-file access, event-voucher quota accounting, real multi-session database races, actual decision-email inbox receipt and the complete combined journey remain pending. Hosted end-to-end acceptance and the final completion percentages are not awarded by these isolated checks.
