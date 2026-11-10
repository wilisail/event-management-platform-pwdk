# Day 6 — Round 3 account acceptance

Updated 10 November 2026, Asia/Jakarta.

## Round 3A — name and photo passed

The owner reported both changes saved and supplied screenshots showing the uploaded photo followed by the saved new display name. Read-only verification found one matching Customer, the reported display name persisted, its existing referral code unchanged, and an owned photo key linked to a real object in the private `profile-pictures` bucket. The stored image is WebP, 2,668 bytes; upload metadata is 10:01:32 WIB and the latest account update is 10:04:35 WIB. No owner email, display name, referral code, object path, account/session ID, password or original screenshot is published here.

Current rewards remain **0 available points, 0 coupons, 0 outgoing referrals and 0 incoming referrals**. Changing a name/photo does not itself earn rewards or replace the referral code. The operator made no changes to this account or its photo.

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
| 3B — next | Copy existing Customer's referral code; register one different Customer with it; inspect both wallets | Verify one referral, one 10,000-point grant for the original Customer and one coupon for the referred Customer, ownership and three-calendar-month expiry |
| 3C | Change password through Keamanan, then sign in with the replacement | Verify the change and account-scoped session revocation; keep separate from Round 2 forgotten-password recovery |
| 3D | Register/login Organizer, inspect own profile/security/referral and dashboard | Verify role restrictions, owned dashboard records, public organizer identity and isolation from the Customer and another Organizer |

The earlier approximately 95% F2 / 73% combined completion figures were planning targets after the whole Round 3, not completion awarded for 3A alone. Real F1 checkout, payment proof, shared purchase decisions, reward restoration, attendance/reviews and decision-email acceptance still belong to the Day 7 dependency list.

## Round 3B — exact controlled signup

Use the [current F2 account app](https://temuevent-dcm4os6gu-andor2.vercel.app/account), [registration](https://temuevent-dcm4os6gu-andor2.vercel.app/register) and [login](https://temuevent-dcm4os6gu-andor2.vercel.app/login). If deployment protection appears, sign into Vercel first, then use the separate TemuEvent account.

1. While signed into the original Customer, open **Referral → Salin kode**. The next registration's referral field supplies the actual clipboard-paste check.
2. Log out. Register one QA account named **QA Referral 1**, choose **Customer**, enter a different address controlled by the owner, use a new TemuEvent password of at least 15 characters and paste the original Customer's code into the optional referral field.
3. Sign into that new Customer and open **Poin & kupon**. Expect **0 points and 1 available coupon**. The current default coupon value is Rp25,000; the PRD leaves that amount configurable.
4. Log out, sign into the original Customer, refresh Referral and Poin & kupon. Expect **1 referred account, 10,000 available points and 0 coupons** for that original account.
5. Report both results, then stop for backend verification before Round 3C. Keep the sender/Vercel Gmail unused for Customer signup so it remains available for the planned Organizer registration.

A controlled Gmail plus-address such as `yourcustomer+temu-ref1@gmail.com` can provide the extra Customer identity while delivering to the original Gmail inbox. No new Gmail inbox needs to be created. The current TemuEvent registration normalizes case/whitespace but retains the plus tag, so it is a distinct TemuEvent email identity. This is a single labeled QA signup for the owner's own project. [Google's address-variation instructions](https://support.google.com/a/users/answer/9282734?hl=en).

[Round 2 acceptance](day-6-round-2-reference.md) · [Completion plan](feature-2-completion-plan.md)
