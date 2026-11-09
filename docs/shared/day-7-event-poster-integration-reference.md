# Day 7 — shared login, event creation and posters

Updated 9 November 2026, Asia/Jakarta, including the schema follow-up below. Wili authorized the available Day 6/7 merges while postponing live F2 and dependency checks until 9 November. This is an incremental code integration; the full purchase journey is still pending.

[PR #41](https://github.com/wilisail/event-management-platform-pwdk/pull/41) is merged into `integration` at `3fa5663f19073fc4dd13cdc6129b89ff95e96068`. Both [Integration CI 42474385346](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/42474385346) and [Feature 2 CI 42474385351](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/42474385351) passed for head `71323d025d777392e003755519b5f711c48b1a09`. The integration job confirms 5 integration tests, 144 F2 tests, 2 operations tests, both SQL harnesses and the production build. [Sanitized evidence](evidence/day-7-integration-2026-11-08.json)

## Source and scope

9 November schema follow-up: Rizky's later commit [`c497ddf04a56a03295571628471e3e4d8429f487`](https://github.com/wilisail/event-management-platform-pwdk/commit/c497ddf04a56a03295571628471e3e4d8429f487), pushed at 21:24 WIB on 8 November, adopts the existing `Attendance` and `OrganizerDecisionEmail` models, their reverse relations and a review index in the root Prisma client. Column/index/foreign-key mappings match F2; local relation aliases differ harmlessly between the two clients. Its new SQL file remains under `prisma/rizky-migrations`, the separate developer history. The shared nine-migration history, runtime connection choice and existing application security remain unchanged. This adds no checkout/payment implementation.

[PR #42](https://github.com/wilisail/event-management-platform-pwdk/pull/42) merged this follow-up into `integration` at `0382ce10c7a329a1ce254cd475dda52737a32f35` on 9 November. [Integration CI 42538801556](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/42538801556) and [F2 CI 42538801541](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/42538801541) both passed for reviewed head `d896e2725c21aac6d46f84982196327bcbd3bff3`. The strict combined build, five HTTP tests, 144 F2 tests, two operations tests, separate two-migration developer replay, nine-migration shared replay and new F1-model/shared-table checks passed. No hosted schema change or new deployment was performed. Use this merged source for the forthcoming combined Preview preparation; the previously published F2 Preview remains a separate test target.

The Day 7 SQL harness now separately replays both F1 developer migrations into a fresh disposable schema, then replays the nine shared migrations in a different disposable database and reads the existing attendance/outbox tables through F1's generated models. It does not execute the developer creation SQL against shared tables. These repository/local checks do not prove that Rizky applied the migration successfully on his laptop or used the private environment ZIP; his terminal result or developer-database migration ledger is still needed for that confirmation.

The completed Day 6 snapshot from [PR #40](https://github.com/wilisail/event-management-platform-pwdk/pull/40) is merged into `feature-2` at `541839b496d246c311d908cddfc7486d7282711a`. Its reusable operations script, bounded QA cleanup, companion notes and successful Node 22 CI are included. The earlier failed CI alert was superseded by [successful run 42178273975](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/42178273975).

This integration combines that checkpoint with Rizky's Cloudinary event-form revision `c07e772cbba2c745b91dd0396909e062d9e1ceea` and his later `feature-1` revision `791ce60c693fcfac3202fe63608c84015716245b`, which adopts the existing shared account/session/referral/reward models in his Prisma schema. The latter changes schema declarations only; it adds no checkout behavior or new SQL migration. Integration changes live on `integration`, with preparation branch `day7-events-integration-20261108`. Rizky's working branch is unchanged.

| Area | Integrated behavior | Still pending |
| --- | --- | --- |
| Public F1 pages | Discovery, event details, organizer event/review feed and same-origin API requests | Final combined browser and real-data acceptance |
| Shared identity | Root organizer login and event form use the existing F2 account/session service; one API process serves both features | Full account/dashboard navigation in the F1 shell; evaluator login check |
| Event publishing | Authenticated organizer creates an event and ticket types, with an optional poster in the same request | Live Cloudinary and target-environment check |
| Ownership | Backend derives organizer ID from the verified session; customer, missing-session and missing-CSRF writes fail | Real multi-account Preview check |
| Poster data | Server-owned `imageUrl` and nullable `imagePublicId` persist through F1's writer and are visible to F2's owned-event reader | Image replacement/deletion lifecycle and provider reconciliation |
| Organizer profile APIs | F1 retains `/api/organizers/:id`; F2 uses `/api/profiles/organizers/:id` for its distinct safe profile projection | Final public-profile/rating check with the configured F1 feed |
| Drafts and event vouchers | Unimplemented controls are visibly unavailable; publishing does not pretend to save them | F1 implementation and shared reward/voucher contract |
| Reviews | Public reads remain. Integrated submission stays closed until session identity, attendance eligibility and the review UI are connected together | Attendance-gated review journey |
| Checkout and payments | Existing preview UI/source is included as incoming F1 work | Real purchase, private proof, shared transitions, seat/reward/voucher restoration and expiry |

## One API and one session authority

`server/integration-runtime.ts` mounts the existing F2 account API behind F1's public/event routes. It returns F2's terminal 404 only after the combined API has had a chance to match. Parent routes preserve the smaller F2 body-parser limits and allow its PATCH preflight requests.

The root Next app uses relative API URLs. In local development, `/api/*` rewrites to the single Express process on port 4002. Hosted builds use `pages/api/[...path].ts` to run the same composed API. The handler preserves the actual URL query, strips untrusted forwarded IP input and uses Vercel's trusted client address when available. Existing F2 session rotation, cookie settings, CSRF and authenticated writes are reused.

The integration entry point does not load `.env.rizky` or select a development/shadow database. It uses the intended shared runtime connection and verified TLS certificate. The F1 development migration baseline under `prisma/rizky-migrations` is retained for its separate purpose; **do not replay that baseline onto the shared database**. No live schema changes were performed in this integration batch. Both Prisma clients were checked against the nine existing shared migrations. Generated root Prisma output and TypeScript build caches are excluded from Git; the run/typecheck/build scripts regenerate the client from the reviewed schema.

F2's standalone UI remains runnable independently. Reusing its backend in the combined API does not mean all its screens are already transplanted into the root F1 layout.

## Event and poster contract

`POST /api/events` requires an active organizer session and session-bound CSRF. Send either JSON without a poster, or multipart data containing `event` (a JSON object string) and one optional `image` (JPEG, PNG or WebP, up to 5 MiB). The server rejects submitted owner IDs, provider IDs and image URLs. Ticket prices must be safe, nonnegative integer rupiah amounts. Event end must be after start.

The form uses the existing F2 browser client, including cross-tab session coordination and a check that the signed-in account still matches the displayed organizer. It sends one multipart mutation and never automatically retries that mutation. A successful response navigates to the created public event.

The server uploads a poster under the organizer's provider folder, persists the returned URL/ID with the event and tickets, and removes temporary disk files. If event creation throws, it checks whether the poster is referenced before deleting it. A confirmed unreferenced poster is cleaned up. A referenced poster or an unavailable reference check preserves the image. The sanitized uncertain-result message tells the user to check their event list before submitting again. Provider timeouts or process termination can still require later reconciliation; this change does not claim an atomic transaction across Cloudinary and PostgreSQL.

The old standalone `/api/uploads/event-image` returns a guarded 409 directing the supported combined request, preventing the browser from uploading an image and abandoning event creation. Public organizer projection returns a picture endpoint rather than the private storage key.

## Run and verify

Use Node 22.12+ and private runtime settings based on `feature-2/.env.example`. From the repository root:

```sh
npm ci
npm --prefix feature-2 ci
npm --prefix database ci
npm run dev
```

Open `http://127.0.0.1:3000/login`, sign in with an existing organizer and publish from `/organizer/events/new`. `npm run dev` starts the root web UI on 3000 and the composed API on 4002. The separate F2 dev command also uses API port 4002; run one API at a time. Put the shared runtime environment in the root `.env` for this combined entry point. Poster uploads additionally need private `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`; account/public-read startup does not require these optional poster settings. Reuse the configured F2 mail/storage settings where required. Never copy secrets into docs or Git.

Available automated checks, also included in `.github/workflows/integration-ci.yml`:

```sh
npm run typecheck
npm --prefix feature-2 run typecheck
npm run test:integration
npm --prefix feature-2 test
(cd database && node --import tsx scripts/verify-day4-isolated.mjs)
(cd database && node --test scripts/day6-ops.test.mjs)
(cd database && node --import tsx scripts/verify-day7-integration.mjs)
TEMUEVENT_HOSTED_API=true NEXT_TELEMETRY_DISABLED=1 npm run build
```

The local integration HTTP suite has five passing tests covering shared login/logout, role/CSRF/owner enforcement, multipart poster persistence, cleanup decisions, account changes and closed unsupported writes. The existing F2 suite has 144 passing tests and the operations suite has two. The existing SQL harness replays nine migrations and checks restricted-role organizer/worker/attendance behavior. The new Day 7 SQL harness creates an event through F1's real Prisma writer and reads it through F2's real organizer repository: the owning organizer sees it, another organizer does not, ticket amounts and seats match, pre-commit failure cleans up, and a lost response after commit retains the event and poster. Its sessions and image provider are controlled fixtures; it uses no live project database or Cloudinary account. Both TypeScript checks and the strict root production build pass. Root Next is aligned with F2 at 16.4.3.

## Deferred acceptance — 9 November onward

1. Check the combined Preview configuration, actual organizer login, event/poster publishing, published display and cross-account denial against the real target services.
2. Confirm the owner's actual reset email receipt and use its link; confirm the evaluator's own protected Preview access and intended demo login.
3. Complete F1 checkout and private proof access, then connect purchase decisions/expiry to the existing shared seat/reward/voucher transition and durable email outbox.
4. Verify real decision emails, timeouts and exactly-once restoration under concurrent requests. Complete attendance-gated review submission and dashboard totals from a real purchase.
5. Finish event editing/deletion, draft/voucher behavior and combined account/dashboard navigation as their F1 interfaces become available.

The Day 6 cleanup evidence is dated 6 November. This batch used disposable local fixtures and did not create new hosted QA records, reconfigure Cron, send real email or publish a production release. Recheck live status with the [operations script](day-6-operations-reference.md) when beginning hosted acceptance.

[Current schedule](feature-2-completion-plan.md) · [Day 6 handoff](day-6-submission-handoff-reference.md) · [Repository workflow](repository-workflow.md)
