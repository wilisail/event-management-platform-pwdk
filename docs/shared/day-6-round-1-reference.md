# Day 6 — Round 1 owner registration and login

Updated 10 November 2026, Asia/Jakarta.

The owner completed Customer registration and login on the protected F2 account Preview. Screenshots show the registration confirmation and authenticated profile, referral, wallet and security screens. Read-only database verification found one matching Customer account, the expected generated referral code, one active session, no incoming or outgoing referral, zero available points and zero coupons. These values agree with a new account registered without a referral.

No owner password, email address, referral code, session identifier or original screenshot is included in this public note. Verification did not change the owner's profile, password, rewards or session.

## Registration-confirmation spacing

The confirmation's inline primary link can paint its vertical padding over the preceding text. The scoped fix makes primary links directly inside an account-card status message inline-flex boxes and adds 16 pixels of top spacing. This also covers the same success-message structure used by password recovery without changing other controls or authentication behavior. Application CI/build validation is recorded with the fix PR; the local browser fixture could not be rendered in the available execution/browser environment, so no visual-pass claim is made here.

## Next checkpoints

- Round 1's owner registration/login check is complete. The owner can stay signed in while the fix is checked and published; logout belongs at the start of the forgotten-password acceptance sequence.
- Profile saving, actual photo upload/replacement, clipboard copying, new referral issuance and password changes have not been manually accepted merely because their controls are visible. Exercise them in Round 3.
- Before Round 2's real customer email test, configure a verified TemuEvent sending domain and its sender address. The default `onboarding@resend.dev` sender's owner-only delivery is a provider setup limitation. Customers and evaluators use ordinary email addresses and do not need Resend accounts. Confirm delivery to a separate customer inbox, then reset and sign in.
- This Preview is the standalone F2 account application. Shared login and organizer event publishing already work in the combined Preview; the complete F1 customer checkout/proof/decision/attendance/review journey remains a Day 7 dependency.

## Published checkpoint

[PR #43](https://github.com/wilisail/event-management-platform-pwdk/pull/43) merged the spacing fix into `feature-2` at `51a528e47f5f20cc40347e930c1a87b8b06c6cd9`. [Feature 2 CI 42732848469](https://github.com/wilisail/event-management-platform-pwdk/actions/runs/42732848469) passed typecheck, application tests, disposable SQL replay/scheduler checks, operations cleanup checks and the production build.

The [updated F2 Preview login](https://temuevent-4vwwj2soj-andor2.vercel.app/login) and [registration](https://temuevent-4vwwj2soj-andor2.vercel.app/register) use reviewed fix source `1877a98e436d68fff684e69c200ec738c4f31117`. Deployment `dpl_Bq7EijudwSiav93F7YWt4bRynhET` is READY; `/api/ready` returned HTTP 200 with `ready: true`, and `/register` returned HTTP 200. Use the existing account on a new Preview; do not register the same identity again. The existing signed-in tab can remain open.

[Sanitized Round 1 evidence](evidence/day-6-round-1-2026-11-10.json)

The deployed stylesheet was fetched and confirmed to contain the scoped inline-flex rule with the 16 px top margin. This establishes that the fix is in the published bundle; the next new-account browser check can confirm its final appearance.
