# Day 6 — Round 3 account acceptance

Updated 10 November 2026, Asia/Jakarta.

Current protected F2 testing link: [My account](https://temuevent-f2-qa-andor2.vercel.app/account) · [Login](https://temuevent-f2-qa-andor2.vercel.app/login) · [Registration](https://temuevent-f2-qa-andor2.vercel.app/register). This stable alias now serves reviewed Feature 2 source `7da6063d5ad26b0f5c16f8da72c978037d87bb7b`; new F2 builds must reassign it only after readiness and access checks. Moving from an older deployment URL requires signing into TemuEvent once on this host. Vercel sign-in and TemuEvent sign-in remain separate.

## Round 3A — name and photo passed

The owner reported both changes saved and supplied screenshots showing the uploaded photo followed by the saved new display name. Read-only verification found one matching Customer, the reported display name persisted, its existing referral code unchanged, and an owned photo key linked to a real object in the private `profile-pictures` bucket. The stored image is WebP, 2,668 bytes; upload metadata is 10:01:32 WIB and the latest account update is 10:04:35 WIB. No owner email, display name, referral code, object path, account/session ID, password or original screenshot is published here.

At the Round 3A checkpoint, rewards were **0 available points, 0 coupons, 0 outgoing referrals and 0 incoming referrals**. The subsequent Round 3B changes are recorded below. Changing a name/photo does not itself earn rewards or replace the referral code. This verification made no changes to this account or its photo.

A separate anonymous HTTP photo probe stopped at Vercel deployment protection (401) before application content could be inspected. It is excluded from application-level authorization claims. Private-bucket configuration, object ownership, the saved object and the owner's displayed photo were verified; the existing source/regression checks remain the evidence for the app's session/role boundaries. No code fix, migration, deployment or new test suite was needed for this acceptance.

[Sanitized Round 3A evidence](evidence/day-6-round-3a-2026-11-10.json)

## Account and role meanings

| Item | Customer account | Organizer account |
| --- | --- | --- |
| Name/photo | Own saved profile | Own separately saved profile; public organizer profile should agree with it |
| Referral code | Own immutable generated code | Own different generated code and own referral summary |
| Password/session | Own credentials and sessions | Own credentials and sessions; changing one account must not alter the other |
| Poin & kupon | Customer wallet, coupon and point histories | This menu is absent; the wallet endpoint requires Customer role |
| Organizer dashboard | Customer cannot access Organizer data | Own events, transactions, attendees and statistics only |

The same profile/security components are reused across roles, while their records remain separate. The Organizer account must not mirror the existing Customer's profile, code or balance. A new Organizer should show empty own-event/dashboard data until test events and transactions belong to it. Later attendee data should reflect the purchasing Customer; that joined purchase/attendance path is Day 7 work.

The owner plans to use the Gmail already used for Vercel/the email sender for the Organizer account. This is allowed, provided that exact email is not already registered as a TemuEvent Customer. Google sender authorization does not create a TemuEvent account. Register it as Organizer with a separate TemuEvent password; no second sender setup is required.

## Remaining Round 3 sequence

| Round | Owner's browser step | Following verification |
| --- | --- | --- |
| 3A | Name/photo save and persistence | Passed: saved name, private stored image, ownership and unchanged referral code |
| 3B — passed | Copied/pasted the original Customer's referral code, registered one separate Customer and inspected both wallets | Verified exactly one referral, one 10,000-point grant for the original Customer and one Rp25,000 coupon for the referred Customer, correct ownership and three-calendar-month expiry |
| 3C — passed | Original Customer changed the known password, was signed out and signed in with the replacement | Account update/new login match the report; all pre-change stored sessions are revoked, profile/rewards remain and the referred Customer is unchanged |
| 3D — baseline passed | Organizer registration/login, security form and empty owned dashboard shown | Verified ORGANIZER role, one active session, own different referral code, zero owned records and no leakage of other owners' events; populated purchase/participant acceptance remains Day 7 |

The earlier approximately 95% F2 / 73% combined completion figures were planning targets after the whole Round 3, not completion awarded for 3A alone. Real F1 checkout, payment proof, shared purchase decisions, reward restoration, attendance/reviews and decision-email acceptance still belong to the Day 7 dependency list.

## Round 3B — referral acceptance passed

The owner completed the controlled signup with a different Customer address and supplied screenshots of both wallets. Copying the existing code and pasting it into the registration referral field supplied the clipboard-paste check. Read-only database verification found exactly one matching referral, one point grant and one coupon; there are no duplicate grants for this signup.

| Record | Original Customer | Referred Customer |
| --- | --- | --- |
| Available points | 10,000 | 0 |
| Platform coupons | 0 | 1 available coupon worth Rp25,000 |
| Referral relation | 1 outgoing referral | 1 incoming referral |
| Ownership | Point grant belongs to this account | Coupon belongs to this account |
| Expiry | 10 February 2027, 10:27 WIB | 10 February 2027, 10:27 WIB |

Both rewards were issued on 10 November 2026, 10:27 WIB and have the expected three-calendar-month expiry. The new Customer's generated referral code is different from the original Customer's code. Coupon redemptions remain **0**. Issuance passed; the coupon is a future ticket discount, not cash paid out, and checkout consumption remains Day 7 acceptance. These real owner-controlled accounts, photo and rewards are retained; this check created no new accounts or rewards.

[Sanitized Round 3B evidence](evidence/day-6-round-3b-2026-11-10.json)

### Signup confirmation and known refresh behavior

The owner's screenshots still used the older immutable `8jbtjn050` Preview, which predates the published spacing fix. Old deployment URLs do not acquire newer code automatically. The current F2 alias serves the reviewed copy change from [PR #54](https://github.com/wilisail/event-management-platform-pwdk/pull/54) and [PR #55](https://github.com/wilisail/event-management-platform-pwdk/pull/55): **“Lanjut ke halaman masuk”**. It deliberately opens login after signup; registration does not automatically issue a session. The existing margin/inline-flex success-link fix is retained.

Both Feature 2 CI runs and Integration CI passed for the one-line change. The fresh F2 build passed Google SMTP authentication without sending a test email, readiness returned HTTP 200 with `ready: true`, and authenticated HTTP checks reached the login, registration, reset and account shells. The published client bundle contains the new copy and the stylesheet contains the success-link spacing rule. This is source/build/HTTP verification; the owner has not yet supplied a fresh visual acceptance of the changed confirmation screen. It can be checked naturally during the later Organizer registration; no additional referred Customer signup is needed.

Rewards/referral data intentionally refetch every **60 seconds while the page is visible**, and when the tab becomes visible again. The existing `useRewardRead` implementation temporarily shows its loading panel during the read. This accounts for the observed brief refresh. It does not reload the whole page, reset profile/password forms, switch accounts or expire a session after one minute. No polling change was made in this batch.

The stable alias retains Vercel Authentication: anonymous requests to login and readiness redirect to Vercel sign-in. Preview-only allowed-origin and password-reset-origin configuration includes this exact alias; sensitive email credentials and Production settings were not changed. The existing once-per-minute worker now targets the alias, with the existing bearer and deployment-protection credentials preserved. Three consecutive post-change worker responses returned HTTP 200 with both queues enabled; runtime completions were confirmed on the new deployment. Future recovery links created by this F2 deployment remain on the stable host.

## Round 3C — known-password change passed

The owner used the stable F2 alias and supplied screenshots of the confirmation dialog, successful sign-out message and original Customer profile after signing in again with the replacement password. Read-only verification found the account updated at **11:07:56 WIB**, its latest stored session revoked at **11:07:57 WIB**, and one new active session created at **11:08:34 WIB**. All five stored sessions created before the account update are revoked; no pre-change session remains unrevoked.

The saved name/photo are present and the referral code is preserved. The original Customer still has **10,000 points, one grant, one outgoing referral and zero coupons**. The referred Customer still has **zero points, one incoming referral and one Rp25,000 coupon**; its account-update timestamp and active/revoked session counts are unchanged from the pre-3C checkpoint. This verification made no account, credential, reward, database-schema or application-code changes.

The owner report/new login, stored account update and session records support this acceptance. No raw password or password hash was read. Manual wrong/previous-password attempts, a replay from a second old browser session and a long idle wait were not performed; the existing focused session/recovery regressions remain separately documented in Round 2 and were not rerun for this unchanged-code acceptance. No fix, migration or redeployment was needed.

[Sanitized Round 3C evidence](evidence/day-6-round-3c-2026-11-10.json)

## Round 3D — Organizer registration/login and empty dashboard passed

The owner reported successful Organizer registration/login and supplied screenshots of the owned event, confirmed participant, transaction and statistics panels, plus the Organizer security form. Read-only verification found one matching Organizer, created at **11:39:09 WIB**, with one active session, its own generated referral code different from both Customers, and no uploaded Organizer photo yet. This is an independent account; its profile/referral and role are not copied from a Customer.

The database contains **zero events owned by this Organizer, zero purchases on its events, zero confirmed purchases and Rp0 completed revenue**. Other owners' events exist and are correctly absent from the new Organizer's screenshot. Both earlier Customer accounts remain present as Customers, and together have **zero purchases**. No missing participant or dashboard defect was found.

### Account registration versus event registration

| Record/action | Meaning | Appears in this Organizer's participant list? |
| --- | --- | --- |
| Customer signs up or logs in | Platform account/session | No |
| Customer signs up using a referral | Account/referral/reward relationship | No |
| Organizer creates an event | Owned event available for later purchase | Creates the event entry, without automatically adding Customers |
| Customer purchase reaches `DONE` for that owned event | Confirmed registration for the event | Yes, including ticket quantity |
| Organizer marks physical attendance | Check-in linked to the confirmed purchase | Updates attendance separately |

The current `listAttendees` query requires the selected event, the verified Organizer's ownership and purchase status `DONE`. Transaction and statistics reads are likewise restricted to events owned by that Organizer. This is an event-management dashboard, not a platform-wide Customer directory. An Organizer should not receive unrelated users' profile or purchase data merely because they registered on TemuEvent.

The screenshot's **Please fill out this field** message is the browser's expected required-field validation on the empty current-password input. The Organizer password was not reported changed and no second change is required for this baseline. Its security form and absence of the Customer wallet menu are visible. The signup-success button's new label/spacing were not explicitly reported in this batch; prior source/build checks remain recorded above.

[Sanitized Round 3D evidence](evidence/day-6-round-3d-2026-11-10.json)

This checkpoint combines the owner's current screenshots, read-only records and current source owner/status filters. The earlier [48 hosted checks](day-7-hosted-preview-reference.md) retain their dated Customer/two-Organizer authorization evidence; no new credentialed negative HTTP replay or nonempty purchase fixture was run against the owner's accounts here. Populated participant, sale, proof, decision and attendance acceptance remains part of the real Day 7 purchase journey. No application fix, database write, migration or redeployment was needed; the real accounts/rewards remain intact.

## Next — Round 4 owned event and poster

Use the new Organizer in the combined event app to create a clearly named test event and ticket type, upload a small poster after provider configuration, publish and reopen the public detail. Then verify that the event belongs to this Organizer and appears in its F2 dashboard. Customer participants still remain empty until an owned-event purchase is confirmed in Round 5.

Cloudinary's setting names and integration code were checked in GitHub; actual API credentials belong in private deployment configuration. A fresh Vercel metadata check confirms all three required Preview variables are absent: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`. The approved Cloudinary account owner must configure them privately in the shared Preview for the upload test. Existing public poster URLs can be displayed without these upload credentials. No credentials were searched for in public source, read, printed or requested in chat.

## Day 7 dependency checkpoint

A fresh read of the combined events endpoint returned HTTP 200 and **12 published events**, all without a stored poster URL. The discovery/API integration is available; these records are not evidence of accepted poster uploads. Preview metadata still has no Cloudinary cloud-name/key/secret variables. Existing public poster URLs can be displayed without upload credentials; a new poster upload needs the approved Cloudinary account configured privately in the shared Preview.

Rizky's current `feature-1` head remains `c497ddf`. Its checkout UI is still a mock and has no order/proof write connected. This establishes an unfinished checkout, not a certified overall F1 completion percentage. Round 4 event publishing/poster integration can progress before checkout is complete; Round 5 must connect the real purchase/proof/decision/expiry path. [Day 7 integration scope](day-7-event-poster-integration-reference.md).

[Round 2 acceptance](day-6-round-2-reference.md) · [Completion plan](feature-2-completion-plan.md)
