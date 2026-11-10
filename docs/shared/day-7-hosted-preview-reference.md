# Day 7 — hosted combined Preview and automated verification

Updated 10 November 2026, Asia/Jakarta.

10 November sender follow-up: the current [combined organizer login](https://temuevent-cs6c3f52i-andor2.vercel.app/login) and [event form](https://temuevent-cs6c3f52i-andor2.vercel.app/organizer/events/new) deploy reviewed integration source `b497dbb8dcf5256774b8293fef3a2343f3973932` with the shared Gmail sender. The [F2 account/recovery app](https://temuevent-hoowk373y-andor2.vercel.app/forgot-password) deploys source `3cfbe9019826437a544e6e1ca0caba3949dff2eb`. Both builds passed real Google SMTP authentication and readiness; the existing scheduler now targets the new F2 worker. See [sender activation](email-sender-setup-reference.md). Actual inbox receipt remains pending. The 48-check result below is the dated 9 November baseline; this follow-up adds deployment/authentication/page/worker smoke checks and does not claim a repeated full purchase journey.

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

Continue with Wili's **Round 1 on the F2 login above**, then inbox recovery, account/profile/reward/dashboard browser checks, and combined organizer event/poster acceptance. Real inbox receipt, evaluator access, final combined navigation and F1 checkout/private proof/transitions/restoration/attendance/reviews remain pending. Temporary QA users are retired and are not demo logins.
