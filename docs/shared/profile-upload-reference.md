# Day 3, part 1 — profile editing and pictures

Updated: 1 November 2026, Asia/Jakarta. Implementation: `feature-2`, with PR #2 still open. This is the companion learning note for the work brought forward from Monday, 2 November. Original focused-time estimate: 45–75 minutes; provider setup is additional when credentials are missing.

## Checkpoint and remaining step

Own-name editing and the real public organizer profile are implemented. Photo selection, confirmation, validation, processing, storage adapter, metadata swap and protected/public image serving are implemented and tested. **Day 3 part 1 is not fully complete until hosted photo storage is configured and a real upload/replacement/read passes.**

The current handoff supplies database and application-session credentials. It does not supply a Supabase Storage backend credential. The TemuEvent project had no storage buckets at the start of this batch. Missing storage does not prevent name editing; the photo route returns a controlled 503 instead of claiming success.

| Verification | Evidence / limit |
| --- | --- |
| Application checks | TypeScript, 111 tests and the production build pass. |
| Real database | Signup/login, both-role name edits, persisted photo keys, current-session identity, customer/organizer visibility, replacements and logout reported `PROFILE_DB_OK`. The temporary test environment reached Supabase when the local workspace could not resolve its database host. |
| Database cleanup | All SQL fixtures rolled back; original user fingerprints matched. A follow-up read found 2 users, 3 events, 30 purchases, zero QA accounts and zero sessions. |
| Photo transport in database tests | An explicit in-memory test transport was used. This is not evidence of a successful hosted Storage request. |
| Browser checks | Desktop (1365 px) and phone (390 px): login, cancel/save/reload name and photo, decoded image, invalid-file feedback and anonymous organizer view passed. No page errors or horizontal overflow; screenshots inspected. These UI checks used disposable memory account records/storage, separately from the real SQL verification above. |
| Hosted storage | Pending the private backend key, private bucket setup and real upload/replacement/read verification. |

No new table, migration or database grant was needed. `users.profile_picture_key` already existed. No shared seed account was reset.

## What the user can do

Both roles use `/account` to edit their own display name. Email, role and referral code remain read-only. A confirmation dialog precedes each name/photo save. The page shows separate success/error states, and successful edits update the account context; a reload reads the current database row.

Photo input accepts JPEG, PNG and WebP. The browser previews the selected file and permits cancellation. A preview is temporary: it is not a saved photo. An organizer is told that their name and photo appear on the public organizer profile.

`/organizers/<real UUID>` now loads a real organizer. Its public response contains ID, name, optional image URL, an empty bio and an unconnected rating slot. No bio editor/table was added. Feature 1 still supplies reviews and rating calculations; `null` means unconnected, not a zero-star rating. The old labelled fixture is at `/preview/organizers/demo-organizer-001`.

## Follow one name change

1. The form sends `PATCH /api/me` with `{ "name": "Nama Baru" }`.
2. Authentication verifies the access cookie, active persisted session and current user. The write guard verifies the application header and session-bound CSRF token.
3. Validation trims the name, requires 2–100 characters, rejects control characters and rejects extra body fields.
4. The repository updates the authenticated user's row. A body/header pretending to select another account cannot choose the write owner.
5. The API projects safe `UserView` fields. The frontend displays the saved name, and later login/refresh/identity reads use the current row.

The route is shared by customer and organizer accounts. A role is not sufficient to edit another person's profile; ownership comes from the verified session.

## File storage versus the database

Think of the image as a parcel and the storage key as its shelf address. Object storage holds the image bytes. PostgreSQL records which shelf address belongs to the user. The database does not hold the photo itself or a temporary signed URL.

| Item | Where it lives | Example |
| --- | --- | --- |
| Original selection | Browser memory, until saved/cancelled | A temporary `blob:` preview |
| Processed photo | Private `profile-pictures` bucket | A still WebP image, at most 512 px on its longest side |
| Object key | `users.profile_picture_key` | `profiles/<authenticated-user-uuid>/<random-uuid>.webp` |
| Own picture URL | Safe identity response | `/api/me/picture?v=<version>`; requires the account session |
| Organizer picture URL | Public organizer response | `/api/organizers/<uuid>/picture?v=<version>`; only organizer photos are public |
| Provider secret | Private backend environment | Never part of a browser response or a `NEXT_PUBLIC_` value |

The version is a cache-busting identifier, not permission to access a file. The serving routes resolve the current stored key on the backend. No arbitrary object-key download route is exposed.

## Follow one photo save

1. The browser sends the actual file bytes to `POST /api/me/picture`, with its image content type and the same application/CSRF headers as other protected writes. This endpoint deliberately uses a bounded raw image body, not multipart or base64 JSON.
2. Authentication and CSRF run **before** the body parser. The parser permits at most 5 MiB and rejects compressed request bodies. Uploads are limited per authenticated user.
3. Sharp decodes the image. A filename or declared MIME type alone is insufficient. Actual JPEG/PNG/WebP format must match; invalid, animated or over-16-megapixel inputs fail.
4. The server applies orientation, resizes within 512 × 512 without enlargement and re-encodes WebP. Original EXIF/location metadata is discarded. At most two image jobs run at once, with bounded pixel size and processing time.
5. Storage receives a new random key under the authenticated user's prefix. Uploads never overwrite an existing object.
6. A short SQL transaction locks the user's row, reads its old key and replaces it with the new key. Remote image transfer does not hold a database lock.
7. After commit, the backend deletes the previous owned image. A database failure triggers candidate cleanup after checking whether the new key actually committed; a lost success reply must not delete the current photo.
8. The safe identity response updates the page. Customer image reads require their session. Anonymous image reads are permitted only through the public organizer route.

File storage and PostgreSQL do not share one atomic transaction. Cleanup is compensating, best-effort work. Failed cleanup emits a sanitized warning; an interrupted process or unavailable provider can leave an unreferenced private object. Reconciliation/retry cleanup remains release hardening, not a guarantee supplied by a SQL rollback. Failed cleanup never reverses a committed name/photo change or deletes another owner's key.

## HTTP contract

Success responses use `{ "success": true, "message": "...", "data": ... }`. Errors use `{ "success": false, "code": "...", "message": "..." }`.

| Route | Access / body | Result |
| --- | --- | --- |
| `PATCH /api/me` | Either signed-in role; application + CSRF headers; JSON `{name}` only | Safe `UserView` |
| `POST /api/me/picture` | Same guards; raw JPEG/PNG/WebP bytes, ≤5 MiB | Safe `UserView` after storage and metadata update |
| `GET /api/me/picture` | Signed-in owner; no caller-selected user or storage key | Current normalized image |
| `GET /api/organizers/:organizerId` | Public; real organizer UUID | Safe `OrganizerView`; customer/missing UUID returns 404 |
| `GET /api/organizers/:organizerId/picture` | Public, but only a real organizer's current photo | Normalized image; no arbitrary customer photo access |

Mutation headers: `X-TemuEvent-Client: web` and `X-CSRF-Token` obtained from `/api/auth/csrf`; cookies remain browser-managed. The client may refresh before a write, but never automatically replays a mutation after a lost response. On an uncertain save, reload the profile before retrying.

Relevant failures: 400 invalid fields/file, 401 missing/revoked session, 403 invalid CSRF/origin, 404 missing profile/photo, 413 oversized body, 415 unsupported image/encoding, 429 per-user editing/upload limit, and sanitized 503 for unavailable profile/storage processing. Image responses use `image/webp`, `no-store` and `nosniff`.

## Finish the provider setup

Use the existing TemuEvent Supabase project, not a new paid project. In the ignored backend `feature-2/.env`, preserve the existing database/session settings and add:

```dotenv
SUPABASE_URL=https://rjjwjacihxepticquxxa.supabase.co
SUPABASE_SECRET_KEY=<private backend secret key>
F2_PROFILE_BUCKET=profile-pictures
```

A legacy `service_role` key can occupy the same backend setting. An anon/publishable key cannot perform these server operations. TemuEvent's application sessions remain the custom Express session system; this does not adopt Supabase Auth.

From the repository root:

```sh
cd feature-2
npm ci
npm run storage:setup
npm run dev
```

`storage:setup` creates the bucket if absent, then verifies **private access, WebP only and a 1 MiB normalized-file limit**. It refuses a conflicting existing configuration instead of silently changing it. No anonymous upload policy is needed; all Storage operations originate on the backend after application authorization.

Then test an actual customer and organizer: save a photo, reload, replace it, verify the old object was removed, confirm a logged-out customer image returns 401, and open the organizer profile anonymously. Also verify that an invalid image leaves the existing photo intact. Until these hosted checks pass, retain the pending status above.

## Reproduce the checks

Run generation/build commands sequentially because their hooks write the same generated Prisma directory.

```sh
npm run typecheck
npm test
npm run build
npm run db:verify:profiles
```

The database verifier requires the private database connection and rolls its SQL fixtures back. Its storage transport is explicitly simulated, even after a provider key is configured; it does not replace the hosted checks above. Existing application tests cover invalid files, private/public projections, spoofed ownership, CSRF, write uncertainty, replacement failure and cleanup behavior.

The feature 2 dependency was patched from Next.js 16.4.0 to **16.4.3** after the build's advisory check failed. Sharp is pinned to **0.35.5** and the Supabase SDK to **2.118.0**. Compatible `body-parser`/`fast-uri` lockfile patches were applied. The production dependency audit reports zero known vulnerabilities at this checkpoint. These version changes are confined to feature 2's package/lockfile.

## Which later parts touch Feature 1?

Day numbers follow the original work sequence: Day 2 rewards, Day 3 accounts, Day 4 decisions, Day 5 dashboard, Day 6 release. They are not renumbered when work is brought forward. See the [completion plan](feature-2-completion-plan.md) for focused-time estimates.

| Day / part | Work | Feature 1 connection / ability to progress |
| --- | --- | --- |
| 3.1 | Own profile/photo and public organizer identity | Own-profile work is independent. Public organizer identity is a handoff; rating/review data still comes from Feature 1. |
| 3.2 | Password change/session revocation | Independent account lifecycle; both features eventually consume the same session authority. |
| 3.3 | Forgotten-password email/reset | Independent account/email flow. |
| 3.4 | Account regression and learning review | Independently test account flows; include shared-login handoff in combined release tests. |
| 4.1 | Owned transaction/proof reads | Direct purchase/proof contract dependency. A real proof viewer needs Feature 1's private file metadata/access interface. |
| 4.2 | Accept/reject and restoration | Strongest direct dependency: call the shared purchase/seat/voucher transition and reward core in one SQL transaction. |
| 4.3 | Decision email outbox/retry | F2-owned delivery; relies on the real accepted/rejected purchase outcome. Worker/provider code can be built independently. |
| 4.4 | Decision/deadline/restoration integration tests | Direct dependency on checkout, proof and timeout behavior. A mocked purchase success does not satisfy completion. |
| 5.1 | Statistics/charts | Read dependency on agreed event/purchase fields, final status and completion date. Queries/charts can begin with shared seed data. |
| 5.2 | Attendee table/manual attendance | Reads Feature 1's confirmed purchases; F2 attendance then supplies Feature 1's review eligibility. |
| 5.3 | Event-management and organizer/rating links | Direct connection to Feature 1 creation/edit screens and rating/review aggregate. |
| 5.4 | Dashboard states/regression | UI-state work can progress independently; final regression includes the connected data/links above. |
| 6.1 | Evaluator deployment/environment | F2 can be deployed alone. Combined checkout/session routing needs both modules. |
| 6.2 | CI, health/logging, scheduled executor | CI/health/logging are independent shared delivery work. The purchase-timeout job must run Feature 1's real transition engine. |
| 6.3 | Full journeys/requirement audit | Direct integration across referral, checkout, proof, organizer decision/timeout, restoration, email, attendance and review. |
| 6.4 | Run guide/evidence/demo/Q&A | F2 guide can be written independently; combined submission evidence requires the real joined journey. |

The extra Friday, 6 November allowance is a **3–6-hour integration/provider/bug-fix buffer**, not another four-part implementation day. Do not confuse the calendar date “6 November” with workday “Day 6”.

For the grader, explain this part with one example: “I select a photo; the browser can preview it, but only the backend can validate it and save it. Storage holds the processed image, and the user's database row holds its key. A session determines whose row I may change.”

References: [Supabase storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals), [storage access control](https://supabase.com/docs/guides/storage/security/access-control), [Sharp output metadata](https://sharp.pixelplumbing.com/api-output/), [Next.js October security update](https://nextjs.org/blog/nextjs-security-update-october-14-2026).
