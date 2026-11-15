# Current UX acceptance — 15 November 2026

Use this checklist for present-day testing. [The earlier D sequence](final-c-hosted-acceptance.md) is an execution history: several of its mutations are already complete. [Demo names and links](demo-ux-walkthrough.md) identify the same retained records after presentation cleanup.

**Temporary F2 branch:** `f2/temporary-purchase-proof-20261115` adds a real saved purchase/proof connection for F2 acceptance. [Scope, replacement contract and remaining dependencies](f2-temporary-purchase-proof.md). The existing hosted observations below remain historical until this branch is deliberately deployed and accepted. Owner evaluation/UX testing is deferred; no accepted records are repeated.

## Source of the rules

The project records and shared contracts describe the assignment scope. A verbatim copy of the original assignment is not stored here, so this checklist does not claim to re-verify every original rubric phrase. Explicit owner decisions take precedence over old working defaults. On 15 November Wili requested that reviews use an optional attendance checkbox and proceed checked or unchecked; Organizer attendance is not a review gate.

The current implementation requires a signed-in Customer with a DONE purchase for a published event and permits one review per Customer/event. Existing reviews retain unknown self-reported attendance rather than inventing an answer. Payment approval confirms payment, independently of optional event check-in.

## Flow and dependency review

| User goal / role | Entry and next action | Required data connection | Current evidence / limit |
| --- | --- | --- | --- |
| Create an event / Organizer | `/organizer/events/new` → fill details/tickets → choose image → publish → inspect own dashboard/public details | Shared session and ownership → event/ticket rows → F1 Cloudinary image | Real publishing/poster integration accepted. It creates an event, not a purchase. Inspect Creator Night for the retained uploaded poster. |
| Discover an event / any visitor | `/` → search/filter → event details | Published event/ticket read API | Public visitor page is explicitly labeled. An Organizer entering through **Lihat halaman publik** is previewing that public page. |
| Buy a ticket / Customer | `/events/{id}/tickets` → **Periksa pesanan** → saved `/transactions/{id}` → private proof | Temporary F2 connection creates purchase/items, reserves seats/real wallet rewards, stores proof and advances status | This branch supports the persisted journey with isolated runtime verification; running QA remains a separate release/owner-acceptance check. Event vouchers remain outside this connection. |
| Review payment / Organizer | `/organizer` → owned transaction → private proof → accept/reject | Owned purchase → atomic status/reward/seat/outbox update | Real F2 runtime and hosted checks passed; Wili accepted the retained DONE/REJECTED outcomes and inbox messages. Those decisions cannot be repeated. |
| View participants / Organizer | Dashboard → **Lihat peserta** → confirmed registrations | Owned DONE purchases/items | Accepted: original Customer, one ticket, Rp45,000. Organizer check-in is optional operational information, not another payment approval. |
| Review the event / Customer with DONE purchase | Event details → **Lihat dan tulis ulasan** → stars/comment/optional attendance → submit | Session + qualifying purchase + unique review + stored optional boolean | Direct navigation and both checkbox states passed at 1280/360/320 px in isolated browser checks; real API/database guards passed. No ticket selection or order confirmation belongs on this page. Wili's original four-star hosted review already exists. |
| Use referral / registering Customer and referrer | Register using a valid referral code → sign in → inspect both wallets | Atomic account/referral/point-grant/coupon writes | Registration/referral previously accepted; verify 10,000-point grant and the configured Rp25,000 referral coupon on the intended accounts. Existing original-Customer balance is 5,000 after spending, not a fresh grant balance. A new signup is a separate test record. |
| Recover a password / either account role | `/forgot-password` → actual email → `/reset-password` → sign in again | Delivery queue/mail, expiring token, new password hash and revoked old sessions | Feature and actual Gmail recovery already accepted. Referred-account recovery stays last; allow about 3–5 minutes depending on delivery. Do not try to reveal the old hash as a password. |
| Verify session separation / Customer, Organizer, signed-out visitor | Logout → restricted page → Customer login → deliberate Organizer URL → Organizer login | Role-aware navigation plus server-side session/ownership guards | Automated guards passed. Owner's final role/logout and evaluator-access acceptance remains pending. |
| Verify expiry/cancellation / background worker | Payment/proof deadlines → scheduled transition → restored seats/rewards | Server timestamps, worker and persisted purchase transition | Existing isolated and hosted evidence covers the transitions. Do not wait two hours/three days in a normal UX tour or alter accepted purchases to simulate them. F1's new-purchase handoff remains a separate dependency. |

Code entry points: `app/organizer/events/new/page.tsx`, `app/events/[eventId]/page.tsx`, `app/events/[eventId]/tickets/page.tsx`, `app/events/[eventId]/review/page.tsx`, `server/integrated.ts`, `server/app.ts`, `feature-2/components/organizer-dashboard.tsx`, `feature-2/server/organizer/event-reviews.ts`, and `feature-2/server/rewards/operations.ts`. Coverage includes `scripts/verify-review-ux.mjs`, `scripts/verify-f1-submission.mjs`, the existing responsive layout verifier and isolated database/runtime runners used by Integration CI. Static/read checks and fixture-backed tests are not evidence of a new live purchase.

## Remaining original steps 1–7

| Original step | Current action | Status |
| --- | --- | --- |
| 1 — Organizer events/transactions | Inspect the retained Temu Kreator event and its two terminal references. They should be DONE/Rp45,000 and REJECTED/Rp25,000. | Already accepted; read-only reconfirmation is optional. |
| 2 — approve payment | Inspect `C-MANUAL-ACCEPT-7d7eb971`, readable proof and final status. Do not press another decision. | DONE and accepted. |
| 3 — reject payment | Inspect `C-MANUAL-REJECT-7d7eb971`, readable proof and final status. Do not repeat rejection. | REJECTED and accepted. |
| 4 — participants/attendance | Inspect one confirmed participant/ticket and 39/40 remaining seats. Attendance has already been recorded and is optional for reviews. | Accepted; no new check-in required. |
| 5 — original Customer/review | Inspect 5,000 available points and the saved four-star review. Do not submit another review. Future eligible reviews allow either checkbox state. | Accepted. |
| 6 — emails and referred Customer coupon | Actual decision emails already accepted. After the last password-recovery check, sign in as the referred Customer and inspect the available Rp25,000 restored coupon. | Inbox complete; own-account coupon UI pending. |
| 7 — logout, roles and evaluator access | Complete the sequence below, then perform referred-account recovery last and finish step 6's coupon inspection. | Owner acceptance pending. |

### Step 7 screen sequence

1. In the Organizer session, click **Keluar**. Open `/organizer` again: it must request login and show no private Organizer data.
2. Sign in as the original Customer. The normal destination is `/account`. Deliberately opening `/organizer` should show the role restriction; this is the expected guard, not a failed Customer login.
3. Click **Keluar**, then sign in as the Organizer. Open `/organizer` and verify its own events, transactions and participants.
4. Open **Lihat halaman publik** once. The role badge remains Organizer, and the page identifies itself as the public visitor view. Use **Dashboard organizer** to return. Event feedback is under **Lihat dan tulis ulasan**, not **Pilih Tiket**.
5. Verify the evaluator can open the intended QA entry using their own authorized Preview access. Owner access alone does not establish evaluator access. Do not share the owner's login password as a substitute.
6. Finally recover the referred Customer account through **Lupa kata sandi**, sign in with its new password and inspect its restored coupon. Never include the reset token or password in an evidence note.

## Low-cost testing split

The assistant first compares the changed screens and routes with this matrix, checks adjacent wording/roles, identifies mocks and runs the relevant existing regressions. Wili then performs one coherent screen tour for clarity, layout and real inbox/account access. The earlier 30–45 minute estimate covers creation/image, referral/account and remaining role/reset checks, depending on typing/email delivery; skip accepted mutations. The new persisted purchase tour is scheduled after this temporary branch is released and its automated checks pass, with a separate estimate.

Record a confusing screen with its role, event/purchase reference, intended task, click and observed result. The assistant handles the code/API/database diagnosis and adds a focused regression where it prevents a real recurrence. Automated checks reduce missed defects; a passing build or route test cannot prove that every label is understandable. This checklist adds no new product scope or test platform.
