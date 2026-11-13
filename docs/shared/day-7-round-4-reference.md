# Day 7 — Round 4 event publishing, navigation and posters

Latest checkpoint — **11 November 2026**: [Round 4B automated poster, navigation and cleanup checks passed](day-7-round-4b-reference.md). Use the stable combined host for discovery, login/account, Organizer dashboard and event creation. Owner screenshots accept Round 4A public/dashboard rendering. The real hosted poster API, saved ownership/image fields, browser image display and exact test cleanup passed. Both CI-verified Preview releases are healthy, with three worker completions; new recovery links use the combined host. This verification did not submit the authenticated browser poster form. Round 5 remains blocked by F1’s mock purchase/proof journey. Earlier checkpoints below are historical.

Updated 10 November 2026, Asia/Jakarta.

Latest checkpoint: owner Cloudinary claim completed; provider upload/read/delete smoke passed. The rebuilt combined app is available at its stable protected alias below. The owner's **QA Round 4A - No Poster** event is published with the expected owner, ticket, schedule and zero purchase totals; current public-page/dashboard visual acceptance remains the owner's next confirmation. [Cloudinary activation evidence](evidence/day-7-cloudinary-activation-2026-11-10.json) · [Round 4A automated evidence](evidence/day-7-round-4a-2026-11-10.json).

## Current test entry points

| Entry | Current purpose |
| --- | --- |
| [F2 Organizer dashboard](https://temuevent-f2-qa-andor2.vercel.app/organizer) | Existing account/Organizer app, now with the **Buat event** link enabled |
| [Combined event form](https://temuevent-combined-qa-andor2.vercel.app/organizer/events/new) | Existing F1 event/ticket form using the shared F2 session/ownership backend |
| [F2 account](https://temuevent-f2-qa-andor2.vercel.app/account) | Existing Customer/Organizer profile, referral and security checks |

Both deployments use the same registered accounts and database. Browser sessions remain scoped to each host, so the first visit to the combined app may require a separate login with the same Organizer credentials. The current link joins the available screens; it is not a claim that final single-host account/dashboard navigation has been completed.

## Navigation configuration published — earlier preparation

The Organizer dashboard already contained a `Buat event` link guarded by `NEXT_PUBLIC_F1_MANAGEMENT_READY` and `NEXT_PUBLIC_F1_ORIGIN`. These settings were absent, which hid the link during Round 3D. Preparation enabled the readiness flag and pointed to the original combined host. Following activation, Preview points to the stable combined alias above. `featureOneUrl` validates the configured origin/path before building the link.

No application source was changed. Reviewed Feature 2 source `7da6063d5ad26b0f5c16f8da72c978037d87bb7b` was rebuilt in READY deployment `dpl_TAxcV2QjZXN6i7Nn2dkSZLHE9ei2`. Its Google SMTP authentication probe and readiness passed; the published Organizer bundle includes the button and intended combined origin. The stable F2 alias was reassigned after these checks. Anonymous access still redirects to Vercel sign-in, and three scheduled worker completions on the new deployment confirm both email queues remain enabled. The worker's stable target URL and existing private credentials were preserved. Production was not changed.

The owner should refresh the existing Organizer dashboard to load this build. A fresh authenticated visual confirmation of the button remains the owner's next observation; no account password or browser cookie was included in this verification.

[Sanitized navigation/provider evidence](evidence/day-7-round-4-preparation-2026-11-10.json)

## Round 4A — publish without a poster

The current form and backend accept an optional poster. When no file is supplied, the backend creates the event/ticket records without calling Cloudinary. This portion can proceed while poster-provider activation is pending.

1. Sign into the combined form as the same newly registered Organizer.
2. Name the test **QA Round 4A — No Poster**, fill category/description/location and choose a future date. Suggested schedule: 17 November 2026, 14:00–16:00 WIB.
3. Use one paid ticket type **Regular**, price **Rp10,000**, quantity **5**. Leave the poster blank and the unavailable voucher/draft controls alone.
4. Choose **Publikasikan Event → Ya, Terbitkan Event**.
5. Report the resulting public event URL and whether it appears in the F2 Organizer dashboard. Then verify event/ticket values, ownership and public response before recording acceptance.

Creating an event does not create purchases or participants. Those remain zero until the later purchase journey is connected.

The original setup included **30 seeded purchases**, with demo event/ticket/identity rows. Those records were inserted by setup SQL and provided sample statuses; they did not establish that an Organizer could create an event through the real UI/API. This round creates one clearly labeled test event through the actual authenticated workflow. Both are test data, but the evidence is different. This verification did not insert an event or new purchase for the owner in this preparation.

## Round 4A — automated record checks passed

The public API now returns the owner's **QA Round 4A - No Poster** event. Read-only database checks confirm one published event belonging to the unique expected Organizer, one **Regular** ticket type priced at **Rp10,000**, quota **5**, and **5** available seats. Schedule: **17 November 2026, 14:00–16:00 WIB**. Both poster columns are null, as intended. The owning Organizer has one event, zero confirmed purchases and Rp0 completed revenue; this event has zero purchases.

[Published test event](https://temuevent-combined-qa-andor2.vercel.app/events/c57ed675-52e4-4d11-b1ca-4250226b5510). Its public detail API and page shell both returned HTTP 200. This verification did not create this database event or alter its tickets. The owner's confirmation that the public page renders correctly and the refreshed dashboard shows one event is still due; API/shell checks are not a fresh authenticated browser visual pass.

## Owned Cloudinary cloud — activated after owner claim

The owner reported completion and supplied Cloudinary's email-verification success screen. The earlier unclaimed deadline is no longer an owner action for this claimed cloud. No claim URL, credential value, owner email or original screenshot is published here.

A direct signed provider test uploaded a **16×16 PNG (79 bytes)** to a unique QA asset, fetched the image successfully with HTTP 200 and image content type, then destroyed that exact asset with HTTP 200 and result `ok`. No database event or purchase was created by the provider test. This proves provider upload/read/delete access; the real event-form → hosted multipart API → saved poster → owner browser display journey remains Round 4B acceptance.

The three existing Cloudinary variables remain private and Preview-only. The activated cloud reuses Rizky's uploader and existing `imageUrl`/`imagePublicId` contract; no F1 branch or application source was changed. Keep the combined Preview on this chosen cloud so later cleanup addresses the account owning its assets.

## Fresh combined and F2 releases

- Combined: READY `dpl_4CaTopi3V1wQK9zsJ41YSP68r1hT`, reviewed integration source `fda6f68a88d6e0023cd3a96a0e72627d898af6b3`, stable alias **https://temuevent-combined-qa-andor2.vercel.app**.
- F2: READY `dpl_AYHZQfFfxVRGby5iswg4bG1txMFf`, reviewed F2 source `7da6063d5ad26b0f5c16f8da72c978037d87bb7b`, existing stable alias **https://temuevent-f2-qa-andor2.vercel.app**. Its published `Buat event` destination now uses the stable combined host.
- Both releases passed Google SMTP authentication and readiness. Combined login, event-form and public events HTTP checks passed; anonymous requests to the combined login still redirect to Vercel Authentication.
- The combined install explicitly installs both root and `feature-2` locked dependency trees. An earlier candidate failed because the F2 Nodemailer tree was missing; the corrected READY release supersedes it.
- Trusted Preview origins include exactly the F2 and combined aliases, alongside the runtime's automatic deployment-URL allowance. Password-reset origin stays on the existing F2 alias. Three post-release scheduled worker completions confirm both email queues remain enabled.
- The old immutable combined URL used for the owner's no-poster form was left available, so the in-progress submission was not interrupted. Future form visits should use the stable combined alias via the refreshed dashboard button.
- Two QA hosts still require separate browser login sessions with the same accounts/database. Final single-host navigation is separate Day 7 work. Production was not changed.

## Round 4B and remaining dependencies

Event editing is not implemented yet. The simplest later poster acceptance is a separate test event named **QA Round 4B — With Poster**. Adding a poster to the original event through an edit screen would require that additional F1 capability. The two tests should remain separately named and their acceptance evidence separately scoped.

Full order creation, private payment proof, shared Organizer decisions, expiry/restoration, Customer ticket confirmation and attendance/reviews remain Round 5 dependencies. No checkout or final single-host navigation completion is claimed by this preparation.
