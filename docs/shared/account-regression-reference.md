# Day 3, part 4 — account regression and learning review

Updated: 1 November 2026, Asia/Jakarta. Brought forward from Monday, 2 November. Implementation remains on `feature-2` in open PR #2; shared notes are carried to `main` and `integration`.

## Checkpoint

**Day 3 Part 4 is complete.** TypeScript, all **138 application tests**, a clean production build and the protected Preview build pass. The combined real Supabase run returned `ACCOUNT_REGRESSION_DB_OK`; browser checks returned `ACCOUNT_REGRESSION_UI_OK` for customer/organizer at both 390 px and 1365 px, including the real Web Locks account-switch scenario. This checkpoint combines the existing account features into complete journeys and provides a learning reference. It adds no new business module or provider. Actual Resend signup-inbox receipt/use remains a separate final manual check for part 3.

A cross-tab profile-edit issue was reproduced and fixed: if a form's save waited behind another tab's login, the browser could attach the new account's cookies to the old account's pending name/photo edit. The client now captures the account before waiting, checks it again after obtaining the shared Web Lock, and refuses a changed identity before fetching CSRF or sending the write. Both name and photo cases have regression tests that failed before the fix and pass afterward. The existing account UI already remounts editors by user ID; the new check protects a request already waiting in the client.

## What the combined checks cover

| Area | Expected behavior / evidence |
| --- | --- |
| Registration and referral | Both roles register, receive an immutable own code, and can use a valid inviter code. Duplicate email cannot issue another account/reward. Real SQL checks newcomer coupons and referrer awards. |
| Login and navigation | Safe account identity comes from the verified session. Role and ownership checks apply at the API. The frontend presents the appropriate account/organizer pages. |
| Profile name | Own name updates; email, role and referral code stay unchanged. Missing CSRF and extra owner fields are refused. A query/header cannot choose a different owner. |
| Profile photo | Real decoding/normalization produces bounded WebP. Replacement removes the old file; invalid data preserves the saved key. Customer pictures require a session; organizer pictures are available through the safe public route. |
| Known-password change | Wrong proof makes no change. A successful update revokes all own sessions; the saved name/photo/rewards survive the new login. |
| Forgotten-password recovery | Known/unknown requests have the same response. Invalid password/token and reused links are refused. Successful reset preserves identity/profile/rewards and revokes existing sessions. |
| Cross-account isolation | One account's edits/password lifecycle do not change another account or revoke its sessions. Queued browser name/photo edits are refused if another tab changed accounts. |
| Browser states | Phone/desktop forms, loading and service-error/retry states, confirmation/cancel, repeated submit, invalid files, saved values after reload, and cross-tab sign-out. |
| Test hygiene | The SQL runner rolls back its entire journey on success or failure and compares baseline counts/user fingerprints. File/mail transports in this combined runner are explicitly in memory. It leaves no new shared QA account or Storage object. |

The reusable runner is `feature-2/scripts/verify-account-regression.ts`, command `npm run db:verify:accounts`. It uses actual HTTP, Prisma, PostgreSQL and scrypt, with the real image normalizer and explicit simulated file/mail transport. Independent hosted Storage and Resend/HTTPS checks are recorded in the earlier companions; this runner does not relabel simulated transport as provider evidence.

## Recorded verification

| Layer | Result and limit |
| --- | --- |
| Client regression | The two queued name/photo account-switch tests fail on the old client and pass after the identity recheck. All 138 application tests and TypeScript pass. |
| Real SQL / HTTP | `ACCOUNT_REGRESSION_DB_OK` covers both complete role journeys using actual Prisma/PostgreSQL/scrypt and the real image normalizer. File/mail transport is simulated. The entire SQL fixture transaction rolls back and all original user fingerprints/counts match. |
| Browser | `ACCOUNT_REGRESSION_UI_OK`: all four role/width combinations complete registration/referral/login, forced loading/error/retry, cancel/repeated click, profile/photo reload, rejected files, password change/two-tab sign-out, recovery and final login. The real browser Web Locks ordering also refuses A's stale edit after B logs in. No page errors or horizontal overflow; four profile/error-state screenshots inspected. Records/files/mail are disposable memory fixtures. |
| Hosting | Protected Preview `temuevent-nyb0tl9xp-andor2.vercel.app` is READY. Its build refuses non-Preview execution, runs the rollback-only SQL verifier and then builds the real app. No production promotion or Git auto-deployment is added. |
| Shared data | Independent follow-up: three users (two original plus the previous live-reset QA account), three events and thirty purchases; zero new account-regression users. The earlier QA account still has zero active sessions/usable links. |

## Follow a profile save through the layers

One example is `PATCH /api/me` with `{ "name": "Nama Baru" }`.

| Step | Responsibility | Where to look |
| --- | --- | --- |
| Browser form | Read/validate the draft, ask for confirmation, display pending/success/error state | `feature-2/components/profile-editor.tsx` |
| Authenticated client | Check the current account, coordinate with login/refresh/logout, recheck after waiting, obtain matching CSRF and send once | `feature-2/lib/auth-client.ts` |
| Express route/guards | Verify cookies, active session and CSRF before bounded JSON parsing; derive the owner from authentication | `server/profile/http.ts`, `server/auth/authorization.ts` |
| Service | Apply the name/file rules and return a safe user view | `server/profile/service.ts` |
| Repository | Perform the database query using the trusted user ID | `server/profile/repository.ts` |
| Database | Enforce constraints, store the result and provide current values on later reads | `database/prisma/schema.prisma`, migrations |
| Browser account state | Render saved values and inform other tabs to reread current identity | `components/auth-provider.tsx` |

The paths in the final five rows are relative to `feature-2` unless they start with `database/`. The backend determines authority. Hiding a button in React is useful presentation; API guards enforce the permission.

## Foundations from Days 1–3

| Foundation | What it means | Reused later |
| --- | --- | --- |
| Shared data model | Users, roles, UUIDs, money/status/time conventions and related records have one shared interpretation | Purchase customer/event owner links, dashboard joins and migrations |
| Authentication | Verify who signed in using short-lived access credentials and persisted sessions | Checkout, proof access, organizer operations and reviews |
| Authorization | Check role and ownership for the requested action | Customer/organizer separation and protection against reading another organizer's purchases |
| Validation and safe responses | Validate fields/file bytes, bound requests and return the agreed JSON shape without secrets | Every future form, API and upload |
| SQL transaction | Coupled writes all commit or all roll back | Referral issuance, password/session changes, purchase/seat/reward/notification changes |
| Concurrency control | Locks and checked state determine how overlapping requests proceed | Duplicate checkout, competing decisions/timeouts and one-use actions |
| Reward ledger | Keep exact earning batches, allocations and original expiry | Correct checkout discounts and once-only restoration |
| Storage adapter | File bytes live in Storage; SQL records the owned key | Profile images now; private payment-proof access follows F1's interface |
| Email adapter and worker | Backend sends after commit, with durable requests, retry/idempotency and an executor | Recovery now; decision notifications on Day 4 |
| Connected browser state | Forms follow actual authenticated API results, including expiry, errors, pending actions and account changes | Organizer decisions and dashboard interactions |

Days 4–5 apply these techniques to different business rules. Day 6 additionally supplies a deployed executor, hosting configuration, automated checks and complete combined journeys. A day is a coherent work group rather than a promise that every group takes the same elapsed time.

## Five distinctions to be able to explain

| Pair | Practical explanation |
| --- | --- |
| Authentication / authorization | A signed-in customer is identified, but still cannot perform an organizer-only action. |
| Storage bytes / SQL metadata | Storage holds the processed picture. The user's SQL row holds its owned key. File transfer and SQL commit are separate operations, so failed swaps need cleanup. |
| Password hash / reset digest | A human password uses salted, deliberately expensive scrypt. A high-entropy reset capability uses a SHA-256 lookup digest and short expiry. Neither plaintext value is stored in SQL. |
| Transaction / lock | A transaction groups changes into one outcome. A lock serializes overlapping work so two requests cannot both act on the same old state. |
| API acceptance / inbox delivery | A successful provider response confirms acceptance. A real inbox test confirms arrival and that its link completes the intended journey. |

A JWT's signature can still be valid after a password changes. The persisted session check rejects it because its session has been revoked. A queue record can survive a process crash, but an executor still has to run to send/retry it. These are the reasons that password change and email delivery each require more than a form and one API call.

## Learning session route

1. Use the app once as a customer and once as an organizer. Observe what is editable, what is read-only and which pages each role can open.
2. Trace the single name-save example above. Identify the browser request, route, guard, service, query and returned user view.
3. Compare name editing with picture upload: point out the additional byte validation, processing, Storage key and replacement cleanup.
4. Compare login, known-password change and forgotten-password reset: identify the proof used by each and the records changed.
5. Read the [reward transaction example](reward-operations-reference.md#integration-shape), then explain how F1's purchase writes and F2's reward writes share one SQL transaction.
6. Try the questions below in plain language before reading the detailed companion files.

Questions to practice:

- Why does a body containing another user's ID fail to select that user's profile?
- Why recheck the account after waiting for a browser lock if the backend already authenticates the request?
- Which photo is saved when an invalid replacement is rejected?
- Why does a password change require a new login on every device?
- How can a restored point grant remain unavailable for spending?
- What happens if a purchase decision commits but the email service fails?
- What does a passing simulated-mail test establish, and what does the real inbox check add?
- Which part of a combined purchase flow belongs to Rizky, and which part belongs to our shared reward service?

## Resend check after Part 4

The real inbox test is still pending. Use the [protected account preview](https://temuevent-nyb0tl9xp-andor2.vercel.app/register). This is a verification Preview, not the final evaluator release.

1. Register a test account using **the email address used for the Resend account signup**, or sign in if that test account already exists. The present `onboarding@resend.dev` sender has that recipient restriction.
2. Open **Login → Lupa kata sandi?**, request the link, and check inbox/spam.
3. Open the email link, choose/confirm a new password and complete the confirmation dialog. The link expires fifteen minutes after the request.
4. Sign in with the new password. The old password should fail; submitting the used link again should be refused.

Use a test-account password. The API key remains in backend settings; this check does not require sharing a key/password/link in chat. Sending to arbitrary customer inboxes later requires a verified owned sender domain.

## Environment and cleanup audit

Verified 1 November: all eight TemuEvent Vercel environment settings are scoped to Preview, including `RESET_API_KEY`, `AUTH_JWT_SECRET`, `DATABASE_URL` and backend Storage settings. The earlier accidental production-target deployment is `CANCELED`. The working app uses the API's `staging` target and injected `VERCEL_ENV=preview`; verification stops before database work in any other environment. Deployment protection remains enabled, with no live production release or Git auto-deployment enabled.

The previous committed live-reset QA account remains because deletion was declined. Its three test sessions are revoked and its reset link is consumed; an independent query found zero active sessions/usable reset links for it. Historical row deletion is optional cleanup and has not been bypassed. This Part 4 verifier creates no additional committed fixtures.

The owner-role Prisma-ledger reconciliation from part 3 remains pending before a later `prisma migrate deploy`. The schema is already applied; do not rerun its CREATE TABLE migration or reset the database. Final hosting, general sender verification, scheduled worker execution, production environment configuration and combined F1/F2 journeys remain Day 6/integration work.

## Reproduce and read further

From `feature-2`, run sequentially:

```sh
npm run typecheck
npm test
npm run build
npm run db:verify:accounts
```

The last command needs the existing private backend `DATABASE_URL` and verified database CA. It uses rollback-only fixtures. Generation hooks write the same generated Prisma directory, so keep these commands sequential.

Read next: [profile/storage](profile-upload-reference.md), [known-password change](password-change-reference.md), [recovery/email](password-reset-reference.md), [sessions](login-session-reference.md), [referral/rewards](reward-operations-reference.md), [Day 3–6 dependency map](profile-upload-reference.md#which-later-parts-touch-feature-1), [completion plan](feature-2-completion-plan.md).
