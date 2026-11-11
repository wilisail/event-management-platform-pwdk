# Day 7 — Round 4B, navigation and poster verification

## State at resumption — 11 November 2026

The owner's screenshots confirm the Round 4A no-poster event renders in public discovery and detail and appears as one published event in the owning Organizer dashboard. Its one Regular ticket remains Rp10,000 with five available seats. This is event publication acceptance; Customer account registration and referral rewards do not create confirmed event participants.

Feature 1 still ends at `c497ddf04a56a03295571628471e3e4d8429f487`. No newer F1 push was available when Round 4B resumed. Its numeric-fixture checkout is a mock, not a database purchase/payment-proof implementation. Round 5 remains blocked on that F1 journey.

The earlier failed combined build omitted the nested F2 email dependency installation. The existing replacement combined and F2 deployments are READY; the failed build is historical, not an indication that the running preview is down.

## Combined application changes

- Mount the existing F2 login, registration, recovery, account and Organizer dashboard components on the combined host with one root AuthProvider and the existing API. Keep F2 standalone support intact.
- Scope the account stylesheet to its layout so account typography and global classes cannot override public discovery pages.
- Reuse the original logo asset on public pages. Replace the separate organizer-only integration login and non-functional public login button.
- Label event details as a public visitor view; label dashboard links `Lihat halaman publik`. Host information on a public event page is not a dashboard.
- Keep creation's post-login return path on the same origin with a restricted route allowlist. Give creation a real dashboard return link.
- Use actual public Organizer picture/initials instead of `JC`. Connect the host-profile button.
- Label illustrative marketing dashboard statistics as examples. Database events show an explicit purchase-unavailable page instead of entering the unrelated numeric-fixture payment mock.

## Intended active pages after release

Use `https://temuevent-combined-qa-andor2.vercel.app` for the complete browser journey: `/` (public discovery), `/events/{eventId}` (public details), `/organizers/{organizerId}` (public host profile), `/login`, `/register`, `/forgot-password`, `/reset-password`, `/account`, `/organizer` (private dashboard) and `/organizer/events/new` (Organizer creation).

The original F2 alias remains a compatibility/operations preview. Browser sessions are host-only: moving from a previous F2 login to the combined host requires signing in once on that host. Old immutable deployment URLs stay historical and do not update when an alias receives a new build.

## Verification scope

Local checks passed: root/F2 TypeScript, root/F2 production builds, 152 F2 tests and six integration tests. The integration suite includes session ownership, multipart poster upload/cleanup behavior, Customer and CSRF restrictions, and same-origin navigation. GitHub CI and the new hosted release still need verification before publication is claimed.

The owned Cloudinary cloud stores uploaded image files; configuring it does not create artwork or populate existing no-poster events. Round 4B reuses the F1 uploader and existing image URL/public-ID contract on the integration branch. It does not change F1's branch or introduce another event-image implementation.

A disposable Organizer and Customer are used for the hosted multipart API test. The owner's real accounts, profile image, rewards and Round 4A event are outside cleanup. Hosted API, database, public image/browser rendering and exact test-only cleanup results will be recorded separately after completion. A direct provider smoke test is not equivalent to an event upload, and an API test must not be described as a browser form submission.

The account rewards panel polls about once per minute and on returning to the tab. That is an existing background rewards read, not an intentional full-page reload.
