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

The standalone F2 application runtime and database schema are unchanged by this merge. Its browser harness now measures document coordinates atomically, so focus-induced smooth scrolling cannot make separately sampled controls appear to overlap. The overlap assertions remain enforced. The published QA release is recorded below; Production and the standalone scheduled worker are separate from this F1 checkpoint.

## Published checkpoint

[PR #95](https://github.com/wilisail/event-management-platform-pwdk/pull/95) is merged into `integration` at `5270be329adc8fd72c0d1cd293e640031ca2e209`. The reviewed head is `fd633a13e0bdeb1b5202ffe9680022712ff153fe`; both commits have the same complete source tree, `369fd4ed9ef9245249dd7e802b12680c2e31a237`.

Both final pipelines passed: [Integration CI #34](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/43614854591) and [Feature 2 CI #49](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/43614854598). Their browser results passed all three viewport widths for F2 layout/participant/session behavior and the F1 same-origin ticket selection, seat cap and sample transaction flow. Preview writes remained zero.

The combined QA alias now points to READY Preview `dpl_JBXJ3Kzqj4SVB3UNm8w4Pyrtgmxv`, built from exact reviewed head `fd633a13e0bdeb1b5202ffe9680022712ff153fe` with Next.js and Node 22. Health, database readiness, event detail and transaction-preview requests returned HTTP 200 before alias assignment. After assignment, alias ownership, readiness and the labelled transaction page were checked again successfully.

- [Combined QA dashboard](https://temuevent-combined-qa-andor2.vercel.app/organizer)
- [QA event ticket selection](https://temuevent-combined-qa-andor2.vercel.app/events/9d9339b2-adb3-4f23-b2ab-fc296391201d/tickets)
- [Sample transaction states](https://temuevent-combined-qa-andor2.vercel.app/transactions/preview)

The existing event still reports its Rp50,000 ticket and 39/40 availability. This pass performed hosted reads only; it created no live purchase, proof, attendance, review, reward redemption or notification. Production, the standalone F2 worker alias and scheduler settings were not changed. D remains partially accepted, and F1 persisted checkout/proof submission remains outstanding.
