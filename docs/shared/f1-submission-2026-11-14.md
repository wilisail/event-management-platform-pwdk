# Feature 1 submission integration — 14 November 2026

Source: Rizky's `feature-1` commit [`3ea0677`](https://github.com/wilisail/event-management-platform-pwdk/commit/3ea06774a8461d649943fb95fc1f0c97af3f192e), **20:19 WIB**, “Adding Transaction Page Mockup”. Target: the current `integration` branch, following the completed D corrections. Wili owns F2 and shared integration; Rizky owns F1.

## Integrated behavior

- Ticket selection reads published event ticket types, prices and availability through the combined same-origin `/api/events/:id` endpoint. Leaving a page cancels its outstanding read.
- Public event detail includes ticket IDs/names/descriptions/quota alongside existing ratings, review counts and Organizer pictures.
- `/transactions/preview` renders Rizky's transaction mockup, including its six status views and local proof-file selection. The ticket preview links to that clearly labelled sample page.
- Ticket and transaction pages keep the shared account/navigation header. Sample voucher/coupon/point amounts and transaction data are identified as examples.

The merge retains the current shared F2 session authority, CORS methods, private-proof/decision implementation, attendance/reviews and D layout corrections. Root auth/read helper files supplied by F1 are retained as source, but are not mounted as a second session authority by the combined runtime. Generated Prisma/build output remains ignored and is regenerated from the current schema. No migration is introduced.

## Functional boundary

This submission is a **UI and event-read checkpoint**. It does not create a persisted purchase, reserve tickets, upload a private payment proof, start an authoritative payment countdown or consume rewards. The status selector and proof submission change only local preview state. Refresh returns the mockup to its initial state. Existing F2 manual purchases and accepted outcomes remain separate.

F1 checkout/proof submission still needs Rizky's implementation and functional acceptance. This integration does not complete the remaining D owner checks, E learning walkthrough or F video work. [Current A–F progress](final-prd-completion-progress.md).

## Verification

Local checks: combined and standalone F2 typechecks; combined production build; **7 integration tests**; **167 F2 application tests**; and the isolated Day 7 database journey (nine shared migrations and F1-write/F2-read checks). No live database or image provider was used by those tests.

Integration CI also runs the existing responsive Organizer/account regression and a new isolated F1 browser flow at **1280, 360 and 320 px**. The F1 check verifies same-origin event reads, ticket seat caps, the sample transaction status/file flow, reset on reload, and zero purchase/proof writes. See the integration PR checks for their final execution result.

The standalone F2 application runtime and database schema are unchanged by this merge. Its browser harness now measures document coordinates atomically, so focus-induced smooth scrolling cannot make separately sampled controls appear to overlap. The overlap assertions remain enforced. The QA release, if updated, uses the reviewed integration commit; Production and the standalone scheduled worker are separate from this F1 checkpoint.
