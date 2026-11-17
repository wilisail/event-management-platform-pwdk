# Current UX acceptance — 16 November 2026

Use this checklist for present-day testing. [The earlier D sequence](final-c-hosted-acceptance.md) is an execution history: several of its mutations are already complete. [Demo names and links](demo-ux-walkthrough.md) identify the same retained records after presentation cleanup.

**Combined QA:** `f2/temporary-purchase-proof-20261115` supplies the real saved purchase/proof connection at **https://temuevent-combined-qa-andor2.vercel.app**. Current source/check/deployment identity is recorded in [PR #98](https://github.com/wilisail/event-management-platform-pwdk/pull/98). [Initial hosted verification and cleanup](f2-temporary-qa-release-2026-11-15.md), [scope/replacement contract](f2-temporary-purchase-proof.md), and [16 November owner review](ux-owner-feedback-2026-11-16.md). Wili completed an exploratory tour, rated intuitive UX **8/10**, and accepted publishing/image, ticket totals/points, saved proof/countdown/decisions, reviews/statistics, recovery and profile rename. This is not a full rubric score. Existing accepted records are retained and must not receive repeated decisions/reviews/resets.

The bounded follow-up adds role/page browser titles, explicit Organizer preview context, honest voucher availability, explained coupon availability, direct wallet/referral links, payment-specific confirmation text, clear order-detail links and long-reference table action layout. The normal Organizer participant UI no longer offers manual attendance marking. Existing attendance records/API remain independent of the optional Customer review checkbox. Release completion is recorded in PR #98 after its checks and QA mapping are verified.

## Source of the rules

The project records and shared contracts describe the assignment scope. A verbatim copy of the original assignment is not stored here, so this checklist does not claim to re-verify every original rubric phrase. Explicit owner decisions take precedence over old working defaults. On 15 November Wili requested that reviews use an optional attendance checkbox and proceed checked or unchecked; Organizer attendance is not a review gate.

The current implementation requires a signed-in Customer with a DONE purchase for a published event and permits one review per Customer/event. Existing reviews retain unknown self-reported attendance rather than inventing an answer. Payment approval confirms payment, independently of optional event check-in.

## Flow and dependency review

| User goal / role | Entry and next action | Required data connection | Current evidence / limit |
| --- | --- | --- | --- |
| Create an event / Organizer | `/organizer/events/new` → fill details/tickets → choose image → publish → inspect own dashboard/public details | Shared session and ownership → event/ticket rows → F1 Cloudinary image | Real publishing/poster integration accepted. It creates an event, not a purchase. Inspect Creator Night for the retained uploaded poster. |
| Discover an event / any visitor | `/` → search/filter → event details | Published event/ticket read API | Public visitor page is explicitly labeled. An Organizer entering through **Lihat halaman publik** is previewing that public page. |
| Buy a ticket / Customer | `/events/{id}/tickets` → **Periksa pesanan** → saved `/transactions/{id}` → private proof | Temporary F2 connection creates purchase/items, reserves seats/real wallet rewards, stores proof and advances status | Deployed on combined QA. Fresh hosted purchases, actual private proof upload/read, normal decisions and reward/seat accounting passed. Owner screen acceptance remains pending. Event vouchers remain outside this connection. |
| Review payment / Organizer | `/organizer` → owned transaction → private proof → accept/reject | Owned purchase → atomic status/reward/seat/outbox update | Real F2 runtime and hosted checks passed; Wili accepted the retained DONE/REJECTED outcomes and inbox messages. Those decisions cannot be repeated. |
| View participants / Organizer | Dashboard → **Lihat peserta** → confirmed registrations | Owned DONE purchases/items | Accepted: the Bandung order adds three tickets/Rp245,000. The participant UI lists confirmed purchases and does not require manual attendance marking. |
| Review the event / Customer with DONE purchase | Event details → **Lihat dan tulis ulasan** → stars/comment/optional attendance → submit | Session + qualifying purchase + unique review + stored optional boolean | Direct navigation and both checkbox states passed at 1280/360/320 px in isolated browser checks. Fresh hosted reviews saved both false and true with zero Organizer attendance rows. No ticket selection or order confirmation belongs on this page. Wili's original four-star hosted review remains retained. |
| Use referral / registering Customer and referrer | Register using a valid referral code → sign in → `/account#referral` or `/account#rewards` | Atomic account/referral/point-grant/coupon writes | One grant/coupon issuance per new referred signup. Xu Harga's 10,000 points have been spent as 5,000 on the original accepted order and 5,000 on Bandung; current available balance is correctly zero. Teman Sixu owns the restored Rp25,000 coupon; Xu Harga has no referral coupon. Purchases do not issue another referral coupon. |
| Recover a password / either account role | `/forgot-password` → actual email → `/reset-password` → sign in again | Delivery queue/mail, expiring token, new password hash and revoked old sessions | Referred-account Gmail recovery and subsequent profile rename are now accepted, 16 November. Do not repeat this reset or reveal credentials. |
| Verify session separation / Customer, Organizer, signed-out visitor | Logout → restricted page → Customer login → deliberate Organizer URL → Organizer login | Role-aware navigation plus server-side session/ownership guards | Automated guards passed; owner screenshots show the expected cross-role restriction. Same-profile Chrome tabs/windows share a login. For simultaneous accounts use one normal and one Incognito window, or different browser profiles, on the same QA host. Evaluator access remains a separate pending check. |
| Verify expiry/cancellation / background worker | Payment/proof deadlines → scheduled transition → restored seats/rewards | Server timestamps, worker and persisted purchase transition | The existing hosted scheduled worker processed newly created temporary QA orders into EXPIRED/CANCELED and restored seats/rewards. Only those test deadlines were accelerated. Do not wait two hours/three days in a normal UX tour or alter accepted purchases. |

Code entry points: `app/organizer/events/new/page.tsx`, `app/events/[eventId]/page.tsx`, `app/events/[eventId]/tickets/page.tsx`, `app/events/[eventId]/review/page.tsx`, `server/integrated.ts`, `server/app.ts`, `feature-2/components/organizer-dashboard.tsx`, `feature-2/server/organizer/event-reviews.ts`, and `feature-2/server/rewards/operations.ts`. Coverage includes `scripts/verify-review-ux.mjs`, `scripts/verify-f1-submission.mjs`, the existing responsive layout verifier and isolated database/runtime runners used by Integration CI. Static/read checks and fixture-backed tests are not evidence of a new live purchase.

## Remaining original steps 1–7

| Original step | Current action | Status |
| --- | --- | --- |
| 1 — Organizer events/transactions | Inspect the retained Temu Kreator event and its two terminal references. They should be DONE/Rp45,000 and REJECTED/Rp25,000. | Already accepted; read-only reconfirmation is optional. |
| 2 — approve payment | Inspect `C-MANUAL-ACCEPT-7d7eb971`, readable proof and final status. Do not press another decision. | DONE and accepted. |
| 3 — reject payment | Inspect `C-MANUAL-REJECT-7d7eb971`, readable proof and final status. Do not repeat rejection. | REJECTED and accepted. |
| 4 — participants/attendance | Inspect one confirmed participant/ticket and 39/40 remaining seats. Attendance has already been recorded and is optional for reviews. | Accepted; no new check-in required. |
| 5 — original Customer/review | Retain the original four-star review and new Bandung review. Current available points are correctly zero after the two 5,000-point purchases. Do not repeat either review. | Accepted. |
| 6 — emails and referred Customer coupon | Earlier decision inbox checks are accepted. Sign in as Teman Sixu with the recovered password and open `/account#rewards` to inspect the Rp25,000 restored coupon. | Recovery complete; coupon availability confirmed by read-only data; its own-account wallet screen remains the useful quick check. |
| 7 — logout, roles and evaluator access | Role guards were observed during the exploratory tour. Use isolated browser profiles for simultaneous accounts and confirm evaluator access separately. | Core role behavior observed; evaluator access pending. |

### Step 7 screen sequence

1. In the Organizer session, click **Keluar**. Open `/organizer` again: it must request login and show no private Organizer data.
2. Sign in as the original Customer. The normal destination is `/account`. Deliberately opening `/organizer` should show the role restriction; this is the expected guard, not a failed Customer login.
3. Click **Keluar**, then sign in as the Organizer. Open `/organizer` and verify its own events, transactions and participants.
4. Open **Lihat halaman publik** once. The role badge remains Organizer, and the page identifies itself as the public visitor view. Use **Dashboard organizer** to return. Event feedback is under **Lihat dan tulis ulasan**, not **Pilih Tiket**.
5. Verify the evaluator can open the intended QA entry using their own authorized Preview access. Owner access alone does not establish evaluator access. Do not share the owner's login password as a substitute.
6. The referred Customer's recovery is already complete. Sign in with that recovered password and inspect `/account#rewards`; no further password reset is required. Never include credentials in evidence.

## Low-cost testing split

The initial 35–50 minute tour has now been completed exploratorily. The assistant compares affected screens with this matrix and runs the existing actual-runtime/browser regressions. After the bounded follow-up release, the owner's useful recheck is only role/preview clarity, the visible order-detail link and Teman Sixu's wallet, roughly 3–5 minutes. Do not repeat purchases, proof uploads, terminal decisions, saved reviews or password recovery merely to inspect these presentation changes.

Record a confusing screen with its role, event/purchase reference, intended task, click and observed result. The assistant handles the code/API/database diagnosis and adds a focused regression where it prevents a real recurrence. Automated checks reduce missed defects; a passing build or route test cannot prove that every label is understandable. This checklist adds no new product scope or test platform.
