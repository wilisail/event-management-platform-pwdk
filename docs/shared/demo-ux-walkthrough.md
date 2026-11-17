# TemuEvent demo preparation — 15 November 2026

Owner decision: attendance is an optional Customer self-report. A DONE purchase remains required for a review. The checkbox does not grant access, change purchase status, or require an Organizer to approve attendance. Existing saved reviews cannot be posted again.

[Current flow/dependency checklist and remaining steps 1–7](current-ux-acceptance.md) is the testing entry point; the tour below supplies event links and release history.

## A coherent tour

Use the combined QA host throughout, with the existing Organizer and Customer accounts. These are presentation updates to the existing records, retaining their dates, ownership, prices, seats, accepted purchases, rewards and review.

| Event | Purpose | Existing state |
| --- | --- | --- |
| [Kopi & Karya Jakarta](https://temuevent-combined-qa-andor2.vercel.app/events/c57ed675-52e4-4d11-b1ca-4250226b5510) | Start with discovery, details and ticket choices. | 17 November, Rp10,000, five seats; previously QA Round 4A. |
| [Creator Night Jakarta](https://temuevent-combined-qa-andor2.vercel.app/events/18c663e1-f361-4c76-8875-d23507520bb7) | Inspect the poster saved through F1's real Cloudinary upload. | 25 November, Rp10,000, three seats; previously QA Round 4B. |
| [Temu Kreator Jakarta: Sesi November](https://temuevent-combined-qa-andor2.vercel.app/events/9d9339b2-adb3-4f23-b2ab-fc296391201d) | Inspect the completed payment, Organizer participant view and saved Customer review. | 13 November, Rp50,000 before rewards, 39/40 seats; previously QA F2. |

1. Open Kopi & Karya from discovery, then inspect its details and ticket selection. The current F1 checkout remains explicitly a mock preview: it creates no purchase/proof and consumes no rewards. Completing that wiring belongs to F1's remaining scope.
2. As Organizer, open `/organizer` and inspect the two existing purchase decisions for Temu Kreator: DONE/Rp45,000 and REJECTED/Rp25,000. Do not repeat decisions. The participant list contains only the DONE purchase, with one ticket.
3. As the original Customer, open Temu Kreator and read the saved four-star review. It is already submitted. Future eligible reviews show **Saya menghadiri event ini**, an optional checkbox; submitting works in either state.
4. Resume Wili's remaining session/role/evaluator checks afterward. Referred-Customer password recovery and its own-account coupon inspection remain last.

All three descriptions identify the records as demo data. The two formerly empty posters use stock photographs already present in F1's project assets. Creator Night retains the original uploaded Cloudinary image and provider ID, demonstrating the actual upload integration.

## Event reviews and order checks are separate

The Customer screenshot headed **Konfirmasi order / Sudah sesuai?**, with a ticket quantity and total, is the checkout confirmation preview. The former checkout labels “review pesanan” and “2 Review” meant checking an order before payment, and are now **periksa pesanan** to avoid confusing them with event reviews.

For event feedback, open the event's **Ulasan & rating → Lihat dan tulis ulasan**. This goes directly to `/events/{eventId}/review`, identified as **Ulasan event**. It has stars, comments and the optional attendance checkbox, with no ticket selection or order confirmation. The Organizer dashboard's **Lihat halaman publik** intentionally opens the visitor-facing event details; return through **Dashboard organizer** for management. The screenshot's **Customer** badge identifies the active role at that moment.

For Temu Kreator, the original Customer's four-star review already exists; opening its review page should display the saved review and prevent another submission. A fresh create → purchase → proof → Organizer confirmation → review journey remains dependent on F1 completing persisted checkout. Referral, password recovery and existing F2 decisions/rewards can be inspected independently.

Published clarification: [PR #97](https://github.com/wilisail/event-management-platform-pwdk/pull/97), integration merge `e13ca7a00fbd4fc323600c8d8a7393d604292769`, reviewed commit `cf1745f69740d006425a73a307d6f60e2bfe0d59` (identical source tree). [Integration CI](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/43690008621) passed the full checks and all six detail-link-to-review cases at 1280/360/320 px, with both attendance answers, no ticket selection and no duplicate form. The usual combined QA alias now serves `dpl_4XaF9xYxbgHdSkVbN3qTQniuwjKb`; readiness and the direct review route returned 200 after assignment. This clarification changed no database records, passwords, purchase decisions or worker configuration.

## Cleanup boundaries

Six published `Backend Test Event`/`Backend Test Event 2` fixtures with no purchases, reviews or attendance are changed to DRAFT. Meaningful owner-created events and all legacy purchases remain. The old 30 demo purchases belong to three different seed organizers; they are not reassigned to the current Organizer merely to populate its dashboard.

The reviewed maintenance SQL is `database/scripts/cleanup-demo-ux-20261115.sql`. It locks the selected rows, rejects changed baseline data or fixtures that acquired activity, and checks that purchase, review, attendance and reward fingerprints remain unchanged. Before-values are in `evidence/demo-ux-before-2026-11-15.json` for a targeted manual rollback. The cleanup is not part of automatic migrations.

## Password recovery

TemuEvent already includes real forgot-password, emailed reset links, reset completion and signed-in password change. Gmail delivery and reset were previously accepted by Wili. No new password feature is needed. Allow approximately **3–5 minutes** for the user's recovery steps, depending on email delivery; request another link only if needed. The prior password is hashed and cannot be displayed. No account credential is changed by this demo preparation.

## Release verification

Local checks: combined and F2 typechecks/build, seven combined integration tests, 167 F2 application tests, and ten isolated Round 6 groups including both attendance answers. The hosted alias is updated only after passing CI, the additive migration and healthy Preview readiness. The release checkpoint records the actual CI and deployment results separately; this guide does not claim the deferred owner checks are complete.

Published: [PR #96](https://github.com/wilisail/event-management-platform-pwdk/pull/96) merged into `integration` at `461250477e0425d90659482f8ed95652c57a1554`. [F2 CI](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/43688684158) and [Integration CI](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/43688684142) passed, including all six optional-checkbox browser cases. The reviewed source `2402550584f95bea6b62e0832d24b8c6278a334c` and merge have the same tree. The combined QA alias now serves deployment `dpl_vvHtW9AhEdYiGJLE8DuiD5VgVvWb`; live readiness and saved-review reads returned 200 after assignment. Migration and guarded cleanup were applied, the original purchase/review/attendance fingerprints match, and security advisors are clear. [Sanitized release evidence](evidence/demo-ux-release-2026-11-15.json).
