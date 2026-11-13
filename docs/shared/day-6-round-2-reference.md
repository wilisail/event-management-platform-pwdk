# Day 6 — Round 2 real recovery acceptance and Round 3 handoff

Updated 10 November 2026, Asia/Jakarta.

**Round 2's real email → password reset → replacement-password login journey passed.** The owner reported the whole process worked. The supplied screenshots show the recovery form, confirmation dialog, successful reset message and authenticated Customer account. Actual inbox receipt is owner-reported; the screenshots are corroborating UI evidence rather than a substitute for inbox confirmation.

No owner email, name, referral code, password, reset capability, session identifier or original screenshot is published in this note.

## Read-only backend verification

| Check | Result |
| --- | --- |
| Matching Customer record | One |
| Recovery job | ACCEPTED, two delivery attempts |
| Reset request / redemption | 09:35:38 / 09:37:49 WIB; redeemed before the 09:50:38 expiry |
| Stored credential | Differs from the job's pre-reset credential fingerprint |
| Outstanding unconsumed reset requests | Zero |
| Active sessions created before redemption | Zero |
| Active sessions created after redemption | One, consistent with the reported new-password login |
| Sessions newly revoked at redemption | Zero: the owner logged out before this test |

The session result confirms no pre-reset session remains active. Because the owner logged out first, this live run does not independently prove the reset invalidated a concurrently active second device. The automated recovery tests cover that behavior for both roles. The verification did not change the owner's password, account, rewards or current session.

The two-attempt result is recorded rather than counted as one attempt. Runtime counts show one recovery-delivery warning on the older Preview's forgot-password route. It is consistent with a request through that old Resend-configured entry, followed by the current Gmail worker's retry; the exact first provider response is not exposed by the sanitized logs. The email ultimately arrived and the request was consumed successfully. Use the current app URLs for future tests.

## Manual scope and automated coverage

| Check | Owner's manual test | Automated evidence |
| --- | --- | --- |
| Actual email arrival, reset and new-password login | Passed | Read-only queue/credential/session records agree |
| Wrong password | Not attempted | Covered by the focused session tests |
| Old password after reset | Not attempted | Covered by the focused recovery test |
| Reused or expired reset link | Not attempted | Covered by recovery tests; live request is already consumed |
| Two concurrently active sessions invalidated by reset | Not attempted; owner logged out first | Covered by recovery tests for both roles |
| Waiting idle for a long time | Deferred | Clock-controlled tests cover expiry/refresh without a seven-day wait |

The focused command `node --import tsx --test tests/password-reset.test.ts tests/sessions.test.ts` passed all **19 tests** with no failures. Those tests use isolated account/mail fixtures and are not represented as manual tests of the owner's private passwords.

Existing behavior uses 15-minute access tokens and a rotating refresh credential within an absolute seven-day session. An expired access token can be renewed silently while that session is valid. A protected request after absolute expiry needs login again. There is no newly added short idle-timeout policy in this checkpoint. The owner deferred a long wall-clock browser wait; it is not a blocker for the next profile checks.

## Recovery confirmation spacing

The screenshot's return-to-login link is rendered by the older recovery Preview. PR #43 already added the scoped inline-flex and 16 px top-margin rule covering this same success-message link. The deployed stylesheet on the updated F2 recovery app was fetched and the rule confirmed.

Preview `F2_PASSWORD_RESET_ORIGIN` now points to `https://temuevent-hoowk373y-andor2.vercel.app`, where that fix is published. Both F2 and combined apps were rebuilt with the updated configuration, passed real Gmail authentication and returned ready:true. The scheduled worker was moved to the refreshed F2 deployment using its existing private Vault credentials. No application code or migration change was needed. The owner need not repeat recovery just to check the cosmetic change; no fresh visual-pass claim is made.

| Current target | Link |
| --- | --- |
| F2 account/profile app | [My account](https://temuevent-dcm4os6gu-andor2.vercel.app/account) · [Login](https://temuevent-dcm4os6gu-andor2.vercel.app/login) · [Forgot password](https://temuevent-dcm4os6gu-andor2.vercel.app/forgot-password) |
| Combined F1/F2 app | [Organizer login](https://temuevent-m978ox58w-andor2.vercel.app/login) · [Create event](https://temuevent-m978ox58w-andor2.vercel.app/organizer/events/new) |

## Round 3 follow-up

Round 3A name/photo acceptance has since passed with read-only account/private-storage verification. Continue with the [current Round 3 sequence and exact referred signup](day-6-round-3-reference.md). The original profile steps below are retained as the earlier handoff.

## Original next owner step — Round 3A only

Keep the same Customer account. If the updated Preview asks for login, use the replacement password; do not register again.

1. In **Profil saya**, change the display name, click **Simpan nama**, confirm, then refresh. The changed name should remain.
2. Choose a small JPEG/PNG/WebP, click **Simpan foto** when it appears, confirm, then refresh. The uploaded photo should remain.
3. Report each result separately. The operator checks the saved record and private stored photo before the next round.

Next subrounds remain separate: actual referral-code copying and new referred-customer issuance; wallet/reward checks; known-password change; organizer account/dashboard and cross-organizer isolation. Reuse an existing Organizer account when available; otherwise it needs an email different from the Customer registration because each account has one role. The sender Gmail is independent of these customer/organizer identities. Real F1 purchase/proof/decision/attendance/review acceptance remains Day 7 work.

[Sanitized Round 2 evidence](evidence/day-6-round-2-2026-11-10.json) · [Sender configuration](email-sender-setup-reference.md)
