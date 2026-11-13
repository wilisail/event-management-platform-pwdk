# Day 7 — Round 6 independent F2 completion

Updated 11 November 2026, Asia/Jakarta. The independent F2 implementation and automated checks are complete in this change. Deployment and owner browser acceptance are separate checkpoints. This report supersedes older statements that the combined app's attendance/review bridge is still unconnected once this change is merged and deployed.

## Delivered

| Area | Implemented behavior |
| --- | --- |
| Attendance and registration | The owner-scoped F2 attendee list contains DONE purchases. Marking attendance remains a separate, idempotent Organizer action anchored to the matching event, customer and confirmed purchase. Signup alone creates no participant. |
| Private eligibility | `GET /api/events/:eventId/reviews/eligibility` requires a Customer session, derives the customer from that session, rejects query identity overrides and returns private/no-store results. It distinguishes missing purchase, missing attendance, an existing review and eligibility. Unpublished/missing events return 404. |
| Review write bridge | The combined runtime connects the existing review endpoint to the shared attendance contract. The insert itself repeats publication, Customer role, DONE purchase and exact attendance predicates while locking the event/purchase source rows. Database uniqueness permits one review per event/customer. A stale eligibility response cannot authorize a later invalid write. |
| Shared browser session | The review page uses the existing F2 session and authenticated client, with CSRF and an account-change check. The fixed development user ID and unconditional eligibility are removed. Anonymous users can sign in and return to the UUID event review path. The confirmation uses a native modal dialog. |
| Ratings and navigation | Event detail links to the review page and reads persisted rating/count data. The F2 public organizer profile reads the shared published-review average/count directly in the combined app, avoiding a self-HTTP lookup. The existing F1 organizer feed remains available. |
| Dashboard totals | Verified real F2 day/month/year statistics in Jakarta time, DONE-only sales, multiple ticket items without multiplying revenue, and exclusion of another Organizer's sales. |
| Uncertain response | A lost successful review response prompts a reload/check and is never automatically posted again. Duplicate requests return 409. |
| Regression fix | A successful poster upload completes temporary-file cleanup before acknowledging success, closing a timing gap exposed by the existing regression check. |

No migration, new database grant, real purchase, shared fixture, payment, external email or hosting change is introduced by this work. Attendance and reviews keep their existing SELECT/INSERT runtime grants. The agreed eligibility rule is confirmed purchase plus marked attendance; this change does not add a separate event-end clock requirement.

## Automated evidence

[Round 6 evidence JSON](evidence/day-7-round-6-f2-isolated-2026-11-11.json)

The runner creates a fresh disposable PostgreSQL database, replays all nine shared migrations and runs as `temuevent_app`. It exercises both generated Prisma clients, the actual combined/F2 routers, authenticated browser client, attendance/review services, public profile/feed and statistics repository. Its seven test users, three events, six purchases, three attendance records and three reviews are discarded when the process closes. No project connection, SMTP or storage credentials are used.

Ten scenario groups cover:

1. Session-derived eligibility; role, CSRF, request and forged-identity denial.
2. Populated DONE attendee rows, ticket quantities and repeated owner checks.
3. Idempotent attendance and eligibility for only the matching customer.
4. Persisted review through the authenticated client, changed-account denial and repeat rejection.
5. Concurrent duplicate HTTP requests and direct SQL writer guards.
6. Jakarta midnight/day/month/year totals, multiple items and owner/status filtering.
7. F2 organizer rating, F1 public review feed and event detail aggregate agreement.
8. Rechecking a previously eligible purchase that ceases to be DONE.
9. Lost response after a successful insert, with exactly one POST and one saved review.
10. Append-only runtime permissions and revoked-session denial.

Concurrent HTTP requests use one disposable physical database connection. They verify request deduplication and persisted uniqueness, but do not establish live independent-session database race acceptance. The disposable connection uses UTC timestamp transport with explicit Jakarta reporting boundaries.

From the repository root, after installing the locked dependencies in the root, `feature-2` and `database`:

```sh
npm run db:generate
npm --prefix database run qa:round6 -- --report /tmp/temuevent-round6-evidence.json
```

Integration CI now runs `qa:round6` after Round 5. Local validation also passed 159 F2 tests, six combined HTTP tests, eleven Round 5 regression groups, both app typechecks and both production builds. The broader validation record belongs in the [daily recap](work-session-2026-11-11.md); source/API/build verification is not visual owner acceptance.

## Scope and final owner window

These are direct F2 outputs for Organizer attendance/statistics and authenticated authorization, plus the attendance dependency consumed by F1 reviews. They support the F2 dashboard's graded behavior; fixture results alone do not establish a final grade or 100% combined completion.

F1 event editing/deletion, retained voucher/draft behavior, real checkout/proof upload and purchase-transition/storage bindings remain with their existing owner. This work does not change `feature-1` or substitute the QA transition adapter into the hosted runtime. Private proof access through the real provider and decision-email receipt in a real inbox remain pending.

No manual interaction is needed to reproduce these automated checks. After a reviewed deployment and reachable fixtures are prepared, combine the remaining human checks into one window: Organizer sees the confirmed sale and marks attendance; Customer sees eligibility, submits one review and sees its published rating; owner checks the real decision email and final evaluator session. Provide verified hosted links before that window. A local test URL is not an owner-accessible handoff.

Persist the source PR, CI result and this evidence before asking for the final merge/deployment decision. Resume from the saved checkpoint after interruption; never recreate an already accepted live sample merely to recover context.
