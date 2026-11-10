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
