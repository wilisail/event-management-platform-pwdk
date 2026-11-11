# Day 7 — hosted combined Preview and automated verification

Latest checkpoint — **11 November 2026**: [Round 4B automated poster, navigation and cleanup checks passed](day-7-round-4b-reference.md). Use the stable combined host for discovery, login/account, Organizer dashboard and event creation. Owner screenshots accept Round 4A public/dashboard rendering. The real hosted poster API, saved ownership/image fields, browser image display and exact test cleanup passed. Both CI-verified Preview releases are healthy, with three worker completions; new recovery links use the combined host. The operator did not submit the authenticated browser poster form. Round 5 remains blocked by F1’s mock purchase/proof journey. Earlier checkpoints below are historical.

Updated 10 November 2026, Asia/Jakarta.

Latest Cloudinary/4A checkpoint: owner claim/email verification completed and a provider upload/read/delete smoke test passed with cleanup. The fresh protected [combined app](https://temuevent-combined-qa-andor2.vercel.app) / [event form](https://temuevent-combined-qa-andor2.vercel.app/organizer/events/new) serves READY deployment `dpl_4CaTopi3V1wQK9zsJ41YSP68r1hT`, source `fda6f68a88d6e0023cd3a96a0e72627d898af6b3`, with Cloudinary Preview credentials. The stable [F2 dashboard](https://temuevent-f2-qa-andor2.vercel.app/organizer) serves `dpl_AYHZQfFfxVRGby5iswg4bG1txMFf`, source `7da6063d5ad26b0f5c16f8da72c978037d87bb7b`, with its existing create-event link targeting the combined alias. SMTP/readiness, compiled navigation, access protection and worker follow-ups passed. The owner's no-poster event passed read-only ownership/ticket/public-API checks; owner visual confirmation and real poster event acceptance remain due. [Current Round 4 evidence](day-7-round-4-reference.md). Earlier checkpoints below are dated history.

Latest navigation/provider checkpoint: the stable [F2 Organizer dashboard](https://temuevent-f2-qa-andor2.vercel.app/organizer) now serves READY deployment `dpl_TAxcV2QjZXN6i7Nn2dkSZLHE9ei2` from reviewed F2 source `7da6063d5ad26b0f5c16f8da72c978037d87bb7b`, with the existing **Buat event** link enabled to the combined form. SMTP/readiness, published bundle, access protection and scheduled worker follow-ups passed. An owned Cloudinary cloud and private Preview settings are prepared; owner claim and a combined-app rebuild/upload/public-display acceptance remain pending. [Round 4 instructions and evidence](day-7-round-4-reference.md).

The combined app remains on `temuevent-m978ox58w-andor2.vercel.app`; its deployed environment snapshot does not yet include the new Cloudinary credentials. The F2 link change does not mount the F2 account/dashboard inside that host. Earlier deployment checkpoints below are historical.

Latest Round 3B checkpoint: use the stable protected [F2 account](https://temuevent-f2-qa-andor2.vercel.app/account), [login](https://temuevent-f2-qa-andor2.vercel.app/login), [registration](https://temuevent-f2-qa-andor2.vercel.app/register) and [recovery](https://temuevent-f2-qa-andor2.vercel.app/forgot-password) links. The alias currently serves F2 source `7da6063d5ad26b0f5c16f8da72c978037d87bb7b` in READY deployment `dpl_FmRH4njpLLeP4UKMksPf4vuxJJ1u`, including the existing spacing fix and clarified signup-to-login label. New F2 recovery links and the existing scheduled worker now use the stable alias. Readiness/SMTP authentication passed, and anonymous access remains behind Vercel sign-in. [Round 3 account/referral evidence and next steps](day-6-round-3-reference.md).

The combined app remains on the existing [organizer login](https://temuevent-m978ox58w-andor2.vercel.app/login) and [event form](https://temuevent-m978ox58w-andor2.vercel.app/organizer/events/new), source `cdbac30dc00c5df576c8aa5db5d7c761a43f3b50`. This copy-only F2 batch did not rebuild the combined app or add checkout. Its existing recovery-origin snapshot still points to the working patched F2 deployment used at Round 2; a later combined rebuild will pick up the stable origin. The deployment URLs below are dated history, not current F2 testing instructions.

Latest Round 2 follow-up: owner inbox/reset/new-password login acceptance passed. Current [combined organizer login](https://temuevent-m978ox58w-andor2.vercel.app/login) and [event form](https://temuevent-m978ox58w-andor2.vercel.app/organizer/events/new) use integration source `cdbac30dc00c5df576c8aa5db5d7c761a43f3b50`. Current [F2 account app](https://temuevent-dcm4os6gu-andor2.vercel.app/account) uses source `3cfbe9019826437a544e6e1ca0caba3949dff2eb`. Both rebuilt with a patched F2 recovery destination and passed SMTP authentication/readiness. See [Round 2 evidence and manual scope](day-6-round-2-reference.md). The earlier deployments and 48-check baseline below remain dated evidence.

Earlier 10 November sender follow-up: the then-current [combined organizer login](https://temuevent-cs6c3f52i-andor2.vercel.app/login) and [event form](https://temuevent-cs6c3f52i-andor2.vercel.app/organizer/events/new) deploy reviewed integration source `b497dbb8dcf5256774b8293fef3a2343f3973932` with the shared Gmail sender. The [F2 account/recovery app](https://temuevent-hoowk373y-andor2.vercel.app/forgot-password) deploys source `3cfbe9019826437a544e6e1ca0caba3949dff2eb`. Both builds passed real Google SMTP authentication and readiness; the existing scheduler now targets the new F2 worker. See [sender activation](email-sender-setup-reference.md). Actual inbox receipt was pending at that checkpoint and subsequently passed in Round 2. The 48-check result below is the dated 9 November baseline; this follow-up adds deployment/authentication/page/worker smoke checks and does not claim a repeated full purchase journey.

## 9 November automated baseline

The combined application is deployed as a protected **Preview** from reviewed integration commit `e1a8a6f77912714bedb057274f797c7cef9f9e21`. The deployment build passed on Node 22 with Next.js 16.4.3. [Sanitized evidence](evidence/day-7-hosted-2026-11-09.json)

| Target | Link and scope |
| --- | --- |
| Combined F1/F2 organizer Preview | [Organizer login](https://temuevent-d9b0gco3k-andor2.vercel.app/login) · [Create event](https://temuevent-d9b0gco3k-andor2.vercel.app/organizer/events/new) |
| F2 account testing | [Login](https://temuevent-8jbtjn050-andor2.vercel.app/login) · [Registration](https://temuevent-8jbtjn050-andor2.vercel.app/register) · [My account](https://temuevent-8jbtjn050-andor2.vercel.app/account) · [Organizer dashboard](https://temuevent-8jbtjn050-andor2.vercel.app/organizer) |
| Password recovery | [Forgot password](https://temuevent-8jbtjn050-andor2.vercel.app/forgot-password) uses the existing F2 recovery UI |

## Automated result

All **48 hosted checks passed** against deployment `dpl_Dwy1GPNRqQRGPtXXfxvHYQEo7mmL`. The build-only verification ran in `dpl_9CFDUnK7gjAH3zqj3JmcytyqpPft`, using one disposable customer and two organizers. The check list in the evidence distinguishes HTTP checks from data assertions.

- Readiness and database connectivity; login and event-form HTML; unauthenticated identity and worker denial.
- Customer/two-organizer login, correct identities and Secure/HttpOnly/SameSite cookies; customer role restrictions; wallet and referral reads; query identity injection denial.
- Missing-CSRF profile denial, saved-name persistence and refresh-token rotation.
- Real event/ticket publishing through the combined F1 writer and shared database; public reads; F2 owner reads; cross-organizer list/attendee isolation; three statistics groupings.
- Password change, both-device session revocation, old-password rejection, new-password login and logout.
- A durable reset request for a nonexistent disposable address reached `SUPPRESSED`, attempt count 1. This exercised queue progress without sending mail.

The fresh read-only operations check confirms all nine shared migration checksums, RLS on the inspected reset/review/attendance/outbox tables, and an active once-per-minute Vault-backed scheduler with recent HTTP 200 worker responses. The profile bucket remains private; anonymous and authenticated Data API roles have no access to the private account schema. This run did not upload profile photos or issue new referral rewards.

## Recovery-origin configuration fix

The combined shell currently has an organizer login and event form; its `/reset-password` page is not yet mounted. To avoid generating links to that missing page, Preview now explicitly sets `F2_PASSWORD_RESET_ORIGIN=https://temuevent-8jbtjn050-andor2.vercel.app`. The existing recovery destination was checked successfully with HTTP 200. The deployed combined source was rebuilt after this configuration change. Keep this trusted destination until combined recovery/account navigation is implemented and verified.

## Cleanup and remaining work

The exact three disposable identities, their sessions/refresh tokens, one event, one ticket type and the suppressed reset job were removed. All targeted remaining counts are zero. Cleanup was atomic and checked identities, ownership, ticket values and unexpected purchase/referral references before deletion. Temporary QA credentials/access were retired.

Cloudinary's three backend variables are absent from the Preview project. Live poster uploading therefore remains blocked on provider configuration. Publishing without a poster passed. The existing isolated poster persistence/recovery tests retain their earlier evidence; they are not a live Cloudinary acceptance result.

Rounds 1, 2, 3A and 3B have passed. Continue with Round 3C known-password change, backend verification, then Round 3D Organizer acceptance. Combined organizer event/poster acceptance, evaluator access, final combined navigation and F1 checkout/private proof/transitions/restoration/attendance/reviews remain pending. Temporary QA users are retired and are not demo logins.
