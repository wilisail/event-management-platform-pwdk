# Day 3, part 2 — password change and session revocation

Updated: 1 November 2026, Asia/Jakarta. Work brought forward from Monday, 2 November. Implementation lives on `feature-2`, in open PR #2. Original focused-time estimate: 45–60 minutes.

## Checkpoint

**Day 3 part 2 is complete.** TypeScript, 125 application tests and a clean production build pass. Real Supabase verification returned `PASSWORD_DB_OK`; six independent-connection PostgreSQL 18 race scenarios returned `PASSWORD_RACES_OK`. Desktop/phone browser checks for both roles returned `PASSWORD_UI_OK`.

Both roles use **Akun saya → Keamanan**. Enter the current password, a new password and its confirmation, then approve the dialog. A successful change signs out **every session belonging to that account, including the current session**. Sign in again with the new password. This all-session policy is a working implementation choice; the PRD does not specify an exception for the current device.

No migration, new database grant, dependency or provider credential is required. This uses the existing `users.password_hash`, `auth_sessions` and `auth_refresh_tokens` records and the same Express session authority as the other account flows.

## What changes, and why

| Item | Behavior |
| --- | --- |
| Current password | Verified with the existing supported-cost scrypt verifier before a change can proceed. An active browser session alone is insufficient proof for this operation. |
| New password | Same shared rule as registration: 15–128 Unicode code points; cannot be only spaces. Spacing and characters are preserved. The current password cannot be reused as the replacement. |
| Confirmation | Checked in the browser; the API accepts only `currentPassword` and `newPassword`. |
| Account owner | Comes from the verified session. A body-supplied user ID/role is rejected; query/header identity claims cannot choose another account. |
| Stored value | A new random-salt scrypt hash. Plaintext passwords stay out of database records, logs, URLs, browser storage and response bodies. |
| Existing sessions | The hash update and all-session revocation commit together. Parent session state makes existing access and refresh credentials unusable on subsequent protected requests. |
| Browser fields | Masked inputs with password-manager autocomplete, paste support, validation, pending state and a confirmation dialog. Fields clear after cancellation or a submitted attempt. |

A password proves knowledge of the account secret. A session is a previously issued sign-in credential. Changing the stored password does not change an already signed JWT's signature; the existing active-session check rejects it because its parent session has been revoked.

Revocation applies to subsequent checks. Already completed reads and in-flight operations are not retroactively canceled. Other devices encounter sign-in on their next protected request. Same-origin tabs additionally receive a `BroadcastChannel` notice immediately.

## Follow one request

`POST /api/auth/password` uses JSON:

```json
{
  "currentPassword": "<current password>",
  "newPassword": "<new passphrase>"
}
```

The browser includes credential cookies, `X-TemuEvent-Client: web` and a current session-bound `X-CSRF-Token`.

1. Authentication checks the signed access credential and persisted session; CSRF checks its matching current refresh credential. These guards precede the password JSON parser and expensive hashing.
2. JSON is bounded to 2 KiB. Five password attempts per authenticated account per fifteen minutes limit repeated proof checking in each running API instance. Deployment-wide rate-limit storage remains part of release hardening.
3. Strict validation rejects extra fields. The service reads the account's current hash and verifies the supplied current password.
4. It derives the new salted hash outside database locks, using the existing two-job scrypt bound. Busy password work returns a controlled 503.
5. The repository starts a short transaction, locks the user row, then locks the matching acting session row. It checks expiry/revocation using a fresh clock reading after obtaining the locks and checks that the password hash still equals the verified snapshot.
6. The transaction updates the password hash and revokes every unrevoked session for that user. A failure rolls both writes back. Refresh-token history is retained; a revoked parent prevents using any old or rotated refresh token.
7. After commit, the HTTP response clears both credential cookies with their matching names/path/security flags and returns `{ "signInRequired": true }`. Production uses Secure, HttpOnly, SameSite=Lax, host-only `__Host-` cookies.
8. The frontend clears local account state and broadcasts a password-change notice without credentials. The login page explains that the new password is required.

The core files are `server/auth/change-password.ts`, `password-repository.ts` and `password-http.ts`. `server/index.ts` supplies the real repository; `server/app.ts` mounts the route. `components/password-editor.tsx` supplies the existing-theme form, with coordination in `lib/auth-client.ts` and `components/auth-provider.tsx`.

## Why login creation also changed

An old-password login can begin before a password change and finish afterward. Password verification happens outside the SQL transaction, so its proof can become stale while the request waits.

Login now captures the exact hash it verified. Session creation takes the same user-row lock as password change and rereads that hash before creating the session. If the password changed meanwhile, login returns the ordinary invalid-credentials response and creates no session/token. If login commits first, the following password change includes that new session in its revocation.

This is a shared identity guarantee. Feature 1 should reuse the agreed authentication/session authority when integrated; it should receive the same revoked-session result. No Feature 1 checkout, event or review implementation is changed by this part.

## Failures and an uncertain response

| Result | Meaning / user action |
| --- | --- |
| 400 `INVALID_PASSWORD_CHANGE` | Invalid length/blank/extra fields; correct the form. |
| 400 `INVALID_CURRENT_PASSWORD` | Current proof failed. The account remains signed in and its password is unchanged. |
| 400 `PASSWORD_UNCHANGED` | Choose a different replacement. |
| 401 `SESSION_REQUIRED` | The session expired or was revoked, including while waiting for a mutation lock. Sign in again. |
| 403 | Missing/wrong application or session-bound CSRF protection; refresh the session safely. |
| 409 `PASSWORD_CHANGE_CONFLICT` | The verified password snapshot changed during the request. Sign in again. |
| 409 `ACCOUNT_CHANGED` (client guard) | Another tab changed accounts while the form waited. No password mutation is sent; reload before submitting. |
| 413 / 415 / 429 | Oversized JSON, incorrect content type or too many attempts. |
| 503 `AUTH_BUSY` | Bounded password work is occupied; no successful change is reported. |
| Network loss or uncertain server failure | The database may already have committed. Automatic refresh/replay stops; sign in with the new password first, then try the previous one if the change did not commit. |

The database and an HTTP response cannot commit atomically together. The client sends the password mutation once, coordinates with refresh/login/logout through the existing Web Lock and never retries the mutation automatically after a lost reply. It rechecks the account identity after acquiring that lock, so a queued form cannot change an account selected by a later login in another tab. Password fields and secrets are absent from cross-tab messages.

## Verification evidence

| Check | Evidence and scope |
| --- | --- |
| Application | TypeScript, 125 tests and a clean production build pass. Tests cover validation, wrong/current/reused passwords, ownership, CSRF, mixed-session cookies, secure cookie clearing, rate limits, sanitized failures and lost-response behavior. |
| Real Supabase | `db:verify:password-change` used real HTTP, Prisma and scrypt for both roles. It checked two-device revocation, exact Unicode/spaces, old-password denial, new-password login, stale-login fencing, another account remaining active, expiry rechecks and injected failure after both SQL writes. |
| Shared-data cleanup | All verifier SQL fixtures rolled back; original user fingerprints matched. An independent query found 2 users, 3 events, 30 purchases, zero sessions, zero refresh-token records and zero password QA users. Shared seed passwords were not reset. |
| Real races | Six scenarios below used distinct PostgreSQL sessions, the existing migrations/RLS/grants and the restricted `temuevent_app` role in an isolated loopback PostgreSQL 18 database. Lock waits were observed through `pg_stat_activity`. The race runner refuses the shared database. |
| Browser | Both roles passed desktop (1365 px) / phone (390 px) checks: field validation/mismatch, cancellation without a write, incorrect-current-password feedback, confirmation, local two-tab BroadcastChannel sign-out, separate-device rejection, old-password denial and exact new-password login. No horizontal overflow or page errors; desktop/mobile/dialog screenshots inspected. Browser account records were disposable memory fixtures; real SQL/crypto were checked separately above. |

| Competing operations | Verified result |
| --- | --- |
| Password change commits before queued old-password login | Stale proof cannot create a session. |
| Old-password login commits before password change | Its new session is included in revocation. |
| Two password changes | Exactly one wins; the other cannot overwrite it. |
| Refresh finishes during password change | Rotated credentials are rejected after revocation. |
| Logout wins its session lock | Queued password change is refused; password remains unchanged. |
| Session expires while waiting for the user lock | Fresh expiry check refuses the change; password remains unchanged. |

The temporary verification VM was stopped and its private database environment file removed. Browser/API deployment is still Day 6 work. Forgotten-password email/reset is the next separate checkpoint, Day 3 part 3; changing a known password does not provide account recovery.

## Reproduce and explain

From `feature-2`, run generation/build commands sequentially:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run db:verify:password-change
```

The live verifier uses the existing private `DATABASE_URL` and rolls its fixtures back. The race command is `npm run db:verify:password-races`; it additionally requires `PASSWORD_RACE_TEST_ALLOW_LOCAL=true` and a separately provisioned `PASSWORD_RACE_DATABASE_URL` targeting loopback database `temuevent_password_test` as `temuevent_app`. It commits disposable fixtures in that isolated database; discard that database after use.

For the grader: “I verify the current password, derive a fresh salted hash, then update that hash and revoke all sessions in one SQL transaction. Login uses the same user lock and rechecks its password proof, so an old-password request cannot sneak a new session in afterward. The browser confirms the action and asks the user to sign in again.”

References: [OWASP password change and reauthentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#change-password-feature), [PostgreSQL row locks](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS), [existing session mechanics](login-session-reference.md), [frontend coordination](frontend-authentication-reference.md), [completion plan](feature-2-completion-plan.md).
