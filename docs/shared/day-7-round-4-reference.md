# Day 7 — Round 4 event publishing, navigation and posters

Updated 10 November 2026, Asia/Jakarta.

## Current test entry points

| Entry | Current purpose |
| --- | --- |
| [F2 Organizer dashboard](https://temuevent-f2-qa-andor2.vercel.app/organizer) | Existing account/Organizer app, now with the **Buat event** link enabled |
| [Combined event form](https://temuevent-m978ox58w-andor2.vercel.app/organizer/events/new) | Existing F1 event/ticket form using the shared F2 session/ownership backend |
| [F2 account](https://temuevent-f2-qa-andor2.vercel.app/account) | Existing Customer/Organizer profile, referral and security checks |

Both deployments use the same registered accounts and database. Browser sessions remain scoped to each host, so the first visit to the combined app may require a separate login with the same Organizer credentials. The current link joins the available screens; it is not a claim that final single-host account/dashboard navigation has been completed.

## Navigation configuration published

The Organizer dashboard already contained a `Buat event` link guarded by `NEXT_PUBLIC_F1_MANAGEMENT_READY` and `NEXT_PUBLIC_F1_ORIGIN`. These settings were absent, which hid the link during Round 3D. Preview now sets the readiness flag to `true` and the F1 origin to the reviewed combined host above. `featureOneUrl` validates the configured origin/path before building the link.

No application source was changed. Reviewed Feature 2 source `7da6063d5ad26b0f5c16f8da72c978037d87bb7b` was rebuilt in READY deployment `dpl_TAxcV2QjZXN6i7Nn2dkSZLHE9ei2`. Its Google SMTP authentication probe and readiness passed; the published Organizer bundle includes the button and intended combined origin. The stable F2 alias was reassigned after these checks. Anonymous access still redirects to Vercel sign-in, and three scheduled worker completions on the new deployment confirm both email queues remain enabled. The worker's stable target URL and existing private credentials were preserved. Production was not changed.

The owner should refresh the existing Organizer dashboard to load this build. A fresh authenticated visual confirmation of the button remains the owner's next observation; no owner password or browser cookie was read by the operator.

[Sanitized navigation/provider evidence](evidence/day-7-round-4-preparation-2026-11-10.json)

## Round 4A — publish without a poster

The current form and backend accept an optional poster. When no file is supplied, the backend creates the event/ticket records without calling Cloudinary. This portion can proceed while poster-provider activation is pending.

1. Sign into the combined form as the same newly registered Organizer.
2. Name the test **QA Round 4A — No Poster**, fill category/description/location and choose a future date. Suggested schedule: 17 November 2026, 14:00–16:00 WIB.
3. Use one paid ticket type **Regular**, price **Rp10,000**, quantity **5**. Leave the poster blank and the unavailable voucher/draft controls alone.
4. Choose **Publikasikan Event → Ya, Terbitkan Event**.
5. Report the resulting public event URL and whether it appears in the F2 Organizer dashboard. The operator then verifies event/ticket values, ownership and public response before recording acceptance.

Creating an event does not create purchases or participants. Those remain zero until the later purchase journey is connected.

The original setup included **30 seeded purchases**, with demo event/ticket/identity rows. Those records were inserted by setup SQL and provided sample statuses; they did not establish that an Organizer could create an event through the real UI/API. This round creates one clearly labeled test event through the actual authenticated workflow. Both are test data, but the evidence is different. The operator did not insert an event or new purchase for the owner in this preparation.

## Owned Cloudinary cloud — owner claim pending

A separate project QA cloud was provisioned through Cloudinary's documented claimable-cloud API. Its cloud name is `zjglczua`. A real authenticated provider ping returned HTTP 200 and `ok`; no asset was uploaded.

The existing three backend variables were saved privately for Vercel **Preview**: cloud name as Config, API key/secret as Sensitive. No credential value or claim URL is published here. The owner receives the claim URL privately in chat. The unclaimed cloud expires at **2026-11-11T05:14:28Z**, or **11 November 2026, 12:14 WIB**. Before claiming, delivery is restricted to the provisioning IP. The owner must complete Cloudinary's claim/email verification to retain the cloud permanently and permit image delivery to other viewers. [Cloudinary's claim instructions](https://github.com/cloudinary/cloudinary_npm/blob/master/docs/get-credentials.md).

This is provider configuration using Rizky's existing uploader, `imageUrl` and `imagePublicId` fields. It does not replace his implementation, alter his branch or introduce a different image contract. Keep the combined Preview on this chosen cloud so later replacement/cleanup targets the account that owns the assets; separate local development clouds can remain private to their developers.

The currently deployed combined host predates these environment values. **After the owner claims the cloud**, rebuild the combined app with the saved Preview configuration, verify upload/persistence/public delivery, and update the F2 navigation destination if the combined URL changes. Credential authentication alone does not prove the upload/public-display story.

## Round 4B and remaining dependencies

Event editing is not implemented yet. The simplest later poster acceptance is a separate test event named **QA Round 4B — With Poster**. Adding a poster to the original event through an edit screen would require that additional F1 capability. The two tests should remain separately named and their acceptance evidence separately scoped.

Full order creation, private payment proof, shared Organizer decisions, expiry/restoration, Customer ticket confirmation and attendance/reviews remain Round 5 dependencies. No checkout or final single-host navigation completion is claimed by this preparation.
