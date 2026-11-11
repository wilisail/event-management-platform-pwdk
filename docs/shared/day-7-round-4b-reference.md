# Day 7 — Round 4B completed automated checks, 11 November 2026

## Result and scope

The hosted authenticated multipart event/poster API, database ownership and poster fields, public image delivery, public browser rendering and exact disposable-fixture cleanup all passed. The visible test pattern rendered at its expected **480×270** dimensions. Customer event writes, writes without CSRF and Customer Organizer-list reads returned **403**. The owner’s Round 4A event and real account/reward records were outside cleanup.

This was a real hosted API upload using disposable QA accounts followed by a browser display check. The operator did **not** submit the authenticated browser event form or read an owner password/cookie. The owner’s existing no-poster form submission supplies Round 4A browser acceptance; a fresh owner-selected poster through the form remains an additional manual acceptance observation, not an operator claim.

Two disposable events, two accounts, their tickets/sessions and two exact Cloudinary test assets were removed. Database verification returned zero matching fixture records; both provider deletions returned HTTP 200/result `ok`. The original no-poster event remains published with five seats.

[Sanitized machine-readable evidence](evidence/day-7-round-4b-2026-11-11.json)

## Active browser journey

Use **https://temuevent-combined-qa-andor2.vercel.app** for the complete journey. Existing accounts work on this host; sign in once because browser cookies are host-only.

| Path | Purpose |
| --- | --- |
| `/` | Public event discovery |
| `/events/{eventId}` | Public event details; opening from a dashboard still shows the visitor view |
| `/organizers/{organizerId}` | Public host profile, not a private dashboard |
| `/login`, `/register` | Shared Customer/Organizer authentication |
| `/forgot-password`, `/reset-password` | Password recovery; new emails target the combined host |
| `/account` | Signed-in profile, referral, Customer points/coupons and password change |
| `/organizer` | Private Organizer-owned events, confirmed attendees, transactions and statistics |
| `/organizer/events/new` | Organizer event creation |

The original F2 alias remains a compatible operational preview. Old immutable deployment URLs stay historical. Moving an alias publishes a new build; a browser refresh fetches the new web app. No application download is needed.

## Page coherence fixes

Reuse the existing F2 account components and API under one root AuthProvider, with account CSS scoped to the account layout. Both root and standalone F2 builds pass. Public pages use the original shared logo instead of separate text marks, and the public header exposes working account/role navigation. The new login accepts either role; creation preserves its allowlisted local return path.

Public detail pages explicitly say **Halaman publik event**. The private dashboard link says **Lihat halaman publik**, and creation links back to the dashboard. The public host card uses the actual photo/initials instead of `JC`, and its profile button navigates. Illustrative homepage statistics are labeled as examples. Database events show an explicit purchase-unavailable screen rather than entering the unrelated numeric-fixture mock checkout.

Fresh browser observations confirmed the shared login layout, public-page branding/label, loaded test poster, signed-out dashboard redirect preserving `next=/organizer`, and purchase-unavailable page. No application hydration error was observed; unrelated browser-extension log errors were excluded.

## Verification and release

PRs [#66](https://github.com/wilisail/event-management-platform-pwdk/pull/66) and [#67](https://github.com/wilisail/event-management-platform-pwdk/pull/67) passed required CI and were merged with expected head SHAs. Local root/F2 typechecks and production builds passed; **152 F2 tests and 6 integration tests** passed. The integration suite covers authenticated multipart ownership, Customer/CSRF restrictions, poster cleanup recovery and same-origin navigation.

The functional combined release is READY `dpl_986RZ11Hbw785zhYKCe3vm7CYsAw`, reviewed integration source `4858194b35720910ada2214be76e6c7b5ace2331`. F2 compatibility/worker release is READY `dpl_HWzh3tw3YcUp7irfxjuRAuRRumXm`, reviewed source `25765432c396276e762dc6642504f458ad26643d`. Both passed SMTP authentication and `/api/ready` returned 200/ready true. Stable aliases were moved after checks. Anonymous access still returns a Vercel Authentication redirect. Three new scheduled worker completions confirm password-reset and decision-email processing enabled. Production was not changed.

The earlier noon Vercel failure was a build missing the nested F2 email dependency installation. Its corrected READY replacements superseded it. New combined installs include both locked dependency trees.

## Known behavior and remaining boundary

The account rewards panel reads fresh data approximately every minute and when returning to the tab. This can briefly show its loading state; it does not intentionally reload the entire page.

Cloudinary stores uploaded posters; enabling it does not create artwork or fill existing no-poster events. This round reused F1’s uploader and `imageUrl`/`imagePublicId` contract on integration. F1’s branch was not changed. Event editing is still unavailable, so the original Round 4A event remains a no-poster event.

Feature 1 still ends at `c497ddf04a56a03295571628471e3e4d8429f487`; there was no newer push to integrate at resumption. Its checkout remains a mock. **Round 5 is not ready**: database-backed purchase creation, proof upload, the two-hour payment deadline and Customer ticket confirmation still need F1 integration before the complete Organizer approval/rejection/expiry journey can be accepted. Platform signup/referral rewards do not create event participants; confirmed participants require a DONE purchase for an event owned by that Organizer.
