# Day 3, part 3 — forgotten-password recovery and email

Updated: 1 November 2026, Asia/Jakarta. Brought forward from Monday, 2 November. Implementation is on `feature-2`, in open PR #2. This note is the cross-feature handoff; the final combined application remains separate integration work.

## Checkpoint and provider

The recovery implementation, companion and automated checks are ready. TypeScript, **136 application tests** and a clean production build pass. Real restricted-role Supabase checks returned `RESET_DB_OK`; eight independent-connection PostgreSQL 18 races returned `RESET_RACES_OK`. Desktop/customer and phone/organizer browser checks returned `RESET_UI_OK`. `RESET_PREVIEW_OK` additionally verified the real protected HTTPS API → Express → Prisma/Supabase → Resend path and successful reset/new-password login. Resend accepted a real API request to its simulated delivery address. **An actual inbox receipt and use of that emailed link still require the account owner's final check.** Simulated delivery, a reconstructed QA token and mock mail are not evidence of inbox receipt.

Working provider: **Resend**, called only by the backend through `server/email/resend.ts`. Its small `Mailer.send({ to, subject, text, html, idempotencyKey })` interface keeps account recovery independent of the transport. The already saved Preview setting is spelled `RESET_API_KEY`; the backend accepts it as an alias for `RESEND_API_KEY`. Sensitive Vercel variable names cannot be renamed in place. Neither value is copied into browser code, returned by the API or committed to Git.

The current sender is `TemuEvent <onboarding@resend.dev>`. This is Resend's test sender: normal inbox delivery is restricted to the email used to register that Resend account. Arbitrary customer delivery requires a verified owned domain and an allowed sender; adding a provider key alone does not remove that restriction. No paid service or production launch is assumed.

## User flow and HTTP contract

Both roles use **Login → Lupa kata sandi?**. Enter the registration email. Every valid request receives the same 202 response: “Jika email terdaftar, tautan pemulihan akan dikirim. Periksa juga folder spam.” It never returns account existence, cooldown status, a token or a provider error.

| Route | Input / result |
| --- | --- |
| `POST /api/auth/forgot-password` | Strict JSON `{ email }`; normalization matches registration. 202 `{ success: true, message, data: null }` after durable enqueue/cooldown. No login required. |
| `/reset-password#token=…` | Page reads the fragment into memory, immediately removes it from the current history entry and supports opening a second link in the same tab. Loading or scanning a GET link does not change a password. |
| `POST /api/auth/reset-password` | Strict JSON `{ token, newPassword }`; 43-character URL-safe token and the shared 15–128 Unicode-code-point password rule. No body-supplied owner/role is accepted. |
| Successful redemption | 200 `{ data: { signInRequired: true } }`; clears matching auth cookies, clears browser account state, broadcasts sign-out and offers login. It does not log the user in automatically. |
| Invalid / expired / used / superseded link | Same 400 `INVALID_RESET_LINK`; request another link. |
| Invalid form / content / size / rate | 400, 415, 413 or 429, with safe messages; no credential change. |
| Busy hashing | 503 `AUTH_BUSY`; bounded password work remains two active scrypt jobs. |
| Missing configuration / database failure | Safe 503. Provider failures happen after enqueue and do not reveal account status. A lost or unexpected reset response is treated as uncertain: try signing in with the new password or request a new link; the client never replays it automatically. |

The public POSTs require `X-TemuEvent-Client: web`, JSON, approved browser Origin and non-cross-site Fetch Metadata. Those guards precede the 2 KiB JSON parser. Request and redemption each have a separate ten-attempt/IP/fifteen-minute limit per running API instance. The durable per-address cooldown is one minute and at most three requests/hour, applied identically to known and unknown addresses. A deployment-wide IP limiter and trusted-proxy configuration remain Day 6 hardening.

The browser validates confirmation, preserves exact password characters/spaces, uses password-manager autocomplete and asks for confirmation before saving. Cancellation and submitted attempts clear password fields. Passwords and raw tokens stay out of local/session storage, response bodies and logs. Pages/API responses set `Referrer-Policy: no-referrer`; the credential is a fragment rather than an HTTP query parameter. Email recipients can still see their own link, as required to recover their account.

## Queue, token and transaction mechanics

The additive migration `20261101091039_password_reset_queue` creates private `temuevent.password_reset_tokens`, mirrored in both Prisma schemas. RLS is enabled and only `temuevent_app` has CRUD; Data API roles have no access. The same table stores a delivery request and, once activated, its one-use capability. Unknown addresses are queued through the same request path, then suppressed by the worker. Rows are pruned after one day, beyond the one-hour cooldown history.

Only a SHA-256 token digest is stored. To retry without storing a plaintext link, the backend derives a separate HMAC key from `AUTH_JWT_SECRET` with the domain `temuevent/password-reset/v1`, then derives a 256-bit URL-safe token from a random request UUID. The UUID alone cannot produce the token without the private key. Session signing and reset derivation have separate cryptographic domains. A queued request created under an old signing key is suppressed on a digest mismatch; an already emailed link can still be redeemed from its stored digest until expiry. Keep the signing secret stable across normal process restarts.

1. The request transaction takes a transaction-scoped advisory lock for the normalized email, checks its cooldown/count and inserts a pending row. It does **not** look up an account or call Resend. The 202 response finishes before the delivery dispatcher begins, removing provider latency from account-existence timing.
2. Workers claim at most five jobs per drain using `FOR UPDATE SKIP LOCKED`, a random lease ID, a one-minute lease and an incremented attempt count. A process crash leaves recoverable SQL state. Separate API instances cannot both claim the same live lease.
3. Activation locks the user row first, then the token row. It checks a fresh clock, lease, token digest, current password hash and account creation time. Unknown/passwordless accounts and requests predating the account are suppressed. The row records its user and a fingerprint of that current salted password hash.
4. Email is sent **outside** SQL locks. A stable `password-reset/<request-id>` idempotency key accompanies every retry. Provider acknowledgement marks `ACCEPTED`; it is not proof of inbox delivery. Failures retry after 5 then 10 seconds, with at most three attempts. A stale worker's acknowledgement cannot overwrite a newer lease. Provider error bodies may contain private account data and are never logged.
5. Redemption reads an eligible digest, derives a new salted scrypt hash outside locks, then locks **user → token** and rechecks the exact current password fingerprint, consumption and expiry using fresh time. In one transaction it changes the password, consumes all outstanding reset requests for that account/email (including pending requests) and revokes every account session. Failure rolls all writes back. Login uses the same user lock and checks its verified password snapshot, fencing an old-password login.
6. Known-password change now also consumes outstanding pending/issued recovery requests in its password/session transaction. A previously emailed or waiting request cannot overwrite the newly changed password. Requesting another email does not itself invalidate an already valid link; the first successful recovery consumes all of them.

The expiry is **15 minutes from request**, including delivery delay. Token hashing serves a high-entropy credential lookup; scrypt serves human password resistance. These have different cost requirements. No Supabase Auth users/session system is introduced: the existing Express authority remains responsible for both features' accounts.

## Runtime and delivery execution

`server/runtime.ts` constructs the actual database/session/profile/password/email services. `server/index.ts` retains the standalone Express entry point and drains the queue every five seconds, at startup and after request responses. Cloud adapters must provide the `defer` callback to retain work after response, and a scheduled executor for retries/recovery while no browser traffic arrives. Durable storage alone cannot run a worker.

The [temporary protected Vercel Preview](https://temuevent-jqt9risyt-andor2.vercel.app/forgot-password) packages the same runtime behind a Next API adapter, injects existing private backend settings and retains a short retry pass. It is for this checkpoint's verification, not an agreement to publish the final application on Vercel. Deployment protection stays enabled; no production release or Git auto-deployment is set up. General sender verification and a continuously scheduled hosted worker remain Day 6 requirements.

Backend configuration: `DATABASE_URL`, stable `AUTH_JWT_SECRET`, `RESEND_API_KEY` (or saved `RESET_API_KEY` alias), `F2_EMAIL_FROM`, optional `F2_EMAIL_PROVIDER=resend`, and a trusted `F2_PASSWORD_RESET_ORIGIN` containing only an origin. A Preview can use injected `VERCEL_URL`; development defaults to localhost:3001. Never derive email links from request Host/Origin headers. Optional `F2_EMAIL_TEST_RECIPIENT` narrows test sends to one inbox.

The migration is applied and live-verified through Supabase's supported migration tool. Prisma's separate migration ledger still needs owner-role reconciliation before `prisma migrate deploy`: `prisma migrate resolve --applied 20261101091039_password_reset_queue`, using a private migration-role `DIRECT_URL` with `schema=temuevent`. The runtime role intentionally has insufficient migration privileges. Automatic review blocked a direct ledger insert; no manual history row, permission broadening or schema reset was performed. Do not rerun the already applied CREATE TABLE migration against this shared database.

## Feature 1 / Rizky handoff

**Rizky need not configure Resend for password recovery.** Feature 2 owns recovery and the planned organizer acceptance/rejection notifications. Feature 1 should reuse the shared account/reset routes and session authority. No API key is needed in Feature 1's browser or independent development setup for those flows.

| Boundary | Integration agreement |
| --- | --- |
| Provider | Resend is the current F2 implementation choice, not a PRD-wide requirement for every module. Another mail adapter is technically possible behind `Mailer`. |
| Decision ownership | F1 owns purchase/proof/timeout transitions; F2 requests organizer decisions through the agreed engine and owns required decision notifications. |
| Commit boundary | The purchase engine commits its state/resource changes and a unique notification event together. Sending happens after commit; an email failure must not roll back a purchase. Day 4 supplies the decision outbox/worker. Do not reuse password-reset rows for purchase notifications. |
| Duplicate prevention | One event owner, stable purchase/transition event ID and shared idempotency/retry rules. Neither feature sends the same decision email independently. |
| If F1 adds other email | Agree the event, recipient and owner before wiring it. A different provider can work, but requires its own sender credentials/delivery handling and must preserve these boundaries. A shared adapter is simpler operationally. |
| Secrets / sender domain | Backend deployment settings only, coordinated by Wili. Do not copy credentials into shared Markdown, frontend env or Git. |

This note makes the contract available in the repository; no message has been sent to Rizky. Any specific provider change should be coordinated before the combined email tests. Day 3 recovery can proceed independently of his purchase engine; Day 4 decision transitions and Day 5 cross-feature journeys still depend on it. Friday, 6 November remains the integration buffer, not an added numbered workday.

## Verification and reproduction

| Evidence | Scope |
| --- | --- |
| 136 tests / TypeScript / clean build | Request equality, strict inputs/guards/limits, digest-only persistence, provider-independent enqueue, expiry/reuse/version checks, both roles, safe errors/cookies, retry/idempotency and lost-response behavior. |
| `RESET_DB_OK` | Real Prisma, restricted role and scrypt; queue activation/suppression/cooldown, rollback after all coupled writes, exact Unicode/spaces, all-device revocation, other-account isolation, pending/issued invalidation by password change and stale worker fencing. All fixtures rolled back. |
| `RESET_RACES_OK` | Eight scenarios on isolated PostgreSQL 18 with independent connections: two redemptions, reset/change both orders, stale login, known/unknown cooldown, skip-locked claim and stale lease acknowledgement, expiry while waiting on the user lock. The runner refuses the shared database. |
| `RESET_UI_OK` | Real browser desktop/phone, both roles: request, fragment removal/reopening, validation/mismatch, cancel/confirmation, two-tab and separate-device sign-out, reused link denial and exact new-password login. Memory account/mail fixtures here; real SQL is checked separately. Screenshots inspected. |
| Protected HTTPS | `RESET_PREVIEW_OK`: real registration, two sessions, queued reset, actual Resend acceptance, GET without consumption, atomic reset, all-device denial, old-password denial, exact new-password login and token reuse refusal. Used the Resend simulated mailbox; a private QA runner reconstructed its capability from the backend key/request ID because that mailbox has no real inbox. The live check created one disposable account; its deletion requires Supabase confirmation. Seed accounts/passwords remain untouched. |
| Resend connectivity | Actual saved secret accepted by Resend at its simulated delivery address. Actual signup-inbox receipt/use remains an explicit final check. |
| Shared data | After rollback-only SQL checks: 2 users, 3 events, 30 purchases; zero sessions, refresh-token or reset records. The separate committed HTTPS check then added one disposable account, three sessions/refresh records and one consumed reset record pending cleanup confirmation. Seed passwords unchanged. |

Run from `feature-2`, sequentially: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, then `npm run db:verify:password-reset` with private backend settings. The isolated race command is `npm run db:verify:reset-races`; it additionally requires `PASSWORD_RACE_TEST_ALLOW_LOCAL=true` and `PASSWORD_RACE_DATABASE_URL` pointing to loopback database `temuevent_password_test` as `temuevent_app`, provisioned with the repository migrations. Never point that runner at the shared project.

For the grader: “The request queues delivery without revealing whether the account exists. The emailed link carries a short-lived secret, but SQL stores its digest. I confirm the replacement, then change the password, consume all recovery links and revoke sessions in one transaction. Worker leases and a stable provider key make retries safe.”

References: [OWASP forgotten-password guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), [Resend email API](https://resend.com/docs/api-reference/emails/send-email), [Resend test-domain restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain), [PostgreSQL explicit locks](https://www.postgresql.org/docs/18/explicit-locking.html), [Prisma migration reconciliation](https://www.prisma.io/docs/orm/prisma-migrate/workflows/patching-and-hotfixing), [password-change companion](password-change-reference.md), [completion plan](feature-2-completion-plan.md).
