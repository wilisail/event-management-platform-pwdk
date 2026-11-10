# Day 6 — Round 3 account acceptance

Updated 10 November 2026, Asia/Jakarta.

Current protected F2 testing link: [My account](https://temuevent-f2-qa-andor2.vercel.app/account) · [Login](https://temuevent-f2-qa-andor2.vercel.app/login) · [Registration](https://temuevent-f2-qa-andor2.vercel.app/register). This stable alias now serves reviewed Feature 2 source `7da6063d5ad26b0f5c16f8da72c978037d87bb7b`; new F2 builds must reassign it only after readiness and access checks. Moving from an older deployment URL requires signing into TemuEvent once on this host. Vercel sign-in and TemuEvent sign-in remain separate.

## Round 3A — name and photo passed

The owner reported both changes saved and supplied screenshots showing the uploaded photo followed by the saved new display name. Read-only verification found one matching Customer, the reported display name persisted, its existing referral code unchanged, and an owned photo key linked to a real object in the private `profile-pictures` bucket. The stored image is WebP, 2,668 bytes; upload metadata is 10:01:32 WIB and the latest account update is 10:04:35 WIB. No owner email, display name, referral code, object path, account/session ID, password or original screenshot is published here.

At the Round 3A checkpoint, rewards were **0 available points, 0 coupons, 0 outgoing referrals and 0 incoming referrals**. The subsequent Round 3B changes are recorded below. Changing a name/photo does not itself earn rewards or replace the referral code. The operator made no changes to this account or its photo.

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

| Round | Owner's browser step | Operator's following check |
| --- | --- | --- |
| 3A | Name/photo save and persistence | Passed: saved name, private stored image, ownership and unchanged referral code |
| 3B — passed | Copied/pasted the original Customer's referral code, registered one separate Customer and inspected both wallets | Verified exactly one referral, one 10,000-point grant for the original Customer and one Rp25,000 coupon for the referred Customer, correct ownership and three-calendar-month expiry |
| 3C — next | Change the original Customer's password through Keamanan, then sign in with the replacement | Verify the change and account-scoped session revocation; keep separate from Round 2 forgotten-password recovery |
| 3D | Register/login Organizer, inspect own profile/security/referral and dashboard | Verify role restrictions, owned dashboard records, public organizer identity and isolation from the Customer and another Organizer |

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

Both rewards were issued on 10 November 2026, 10:27 WIB and have the expected three-calendar-month expiry. The new Customer's generated referral code is different from the original Customer's code. Coupon redemptions remain **0**. Issuance passed; the coupon is a future ticket discount, not cash paid out, and checkout consumption remains Day 7 acceptance. These real owner-controlled accounts, photo and rewards are retained; no new accounts or rewards were created by the operator for this check.

[Sanitized Round 3B evidence](evidence/day-6-round-3b-2026-11-10.json)

### Signup confirmation and known refresh behavior

The owner's screenshots still used the older immutable `8jbtjn050` Preview, which predates the published spacing fix. Old deployment URLs do not acquire newer code automatically. The current F2 alias serves the reviewed copy change from [PR #54](https://github.com/wilisail/event-management-platform-pwdk/pull/54) and [PR #55](https://github.com/wilisail/event-management-platform-pwdk/pull/55): **“Lanjut ke halaman masuk”**. It deliberately opens login after signup; registration does not automatically issue a session. The existing margin/inline-flex success-link fix is retained.

Both Feature 2 CI runs and Integration CI passed for the one-line change. The fresh F2 build passed Google SMTP authentication without sending a test email, readiness returned HTTP 200 with `ready: true`, and authenticated HTTP checks reached the login, registration, reset and account shells. The published client bundle contains the new copy and the stylesheet contains the success-link spacing rule. This is source/build/HTTP verification; the owner has not yet supplied a fresh visual acceptance of the changed confirmation screen. It can be checked naturally during the later Organizer registration; no additional referred Customer signup is needed.

Rewards/referral data intentionally refetch every **60 seconds while the page is visible**, and when the tab becomes visible again. The existing `useRewardRead` implementation temporarily shows its loading panel during the read. This accounts for the observed brief refresh. It does not reload the whole page, reset profile/password forms, switch accounts or expire a session after one minute. No polling change was made in this batch.

The stable alias retains Vercel Authentication: anonymous requests to login and readiness redirect to Vercel sign-in. Preview-only allowed-origin and password-reset-origin configuration includes this exact alias; sensitive email credentials and Production settings were not changed. The existing once-per-minute worker now targets the alias, with the existing bearer and deployment-protection credentials preserved. Three consecutive post-change worker responses returned HTTP 200 with both queues enabled; runtime completions were confirmed on the new deployment. Future recovery links created by this F2 deployment remain on the stable host.

## Round 3C — do this next, then pause

1. Open [My account](https://temuevent-f2-qa-andor2.vercel.app/account) and sign into the **original Customer** using the latest password established in Round 2. Confirm the saved name/photo and 10,000 points belong to that account.
2. Open **Keamanan**. Enter the current TemuEvent password, then a different new password of 15–128 characters and the matching confirmation. Keep these values private.
3. Click **Ubah kata sandi**, then **Ya, ubah dan keluar**. All sessions for this Customer should end, including the current session.
4. Sign in again with the replacement password and confirm the original profile and rewards remain intact.
5. Report the result, then pause for the operator's credential/session verification before Round 3D. The separate referred Customer's password and account must remain unchanged.

Round 3D will register/login the separate Organizer account, then inspect its own profile/security/referral and empty owned dashboard before named event/transaction fixtures. The planned sender/Vercel Gmail may be used for that Organizer provided it is not already registered in TemuEvent. No second Gmail sender authorization is needed.

[Round 2 acceptance](day-6-round-2-reference.md) · [Completion plan](feature-2-completion-plan.md)
