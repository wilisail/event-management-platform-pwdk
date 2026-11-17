# Owner UX review — 16 November 2026

Wili completed an exploratory screen tour and rated its intuitive flow **8/10**, independently of a full PRD/rubric audit. Twenty-three supplied photos support eleven comments. Preserve the working flow; make bounded clarity/layout changes and assess full PRD coverage separately.

## Journey and action map

| Comment | Role → entry → action → data/result | Finding and bounded action |
| --- | --- | --- |
| 1. Sessions and mixed roles | Organizer/Customer → same QA host in ordinary tabs → login → shared session cookie | Same-profile tabs share the active account. Use one normal and one Incognito window, or separate browser profiles, for simultaneous roles. Keep session security; add role/page tab titles, persistent role labels and clear Organizer public-preview context. Organizer previews must not offer editable Customer checkout controls. Independent per-tab authentication is outside this refinement. |
| 2. Event promotion voucher | Organizer → event creation → unavailable toggle → no voucher write | Organizer-created event vouchers are a separate F1 requirement/dependency. Replace the unusable activation control with an honest availability note. Do not simulate a working voucher or introduce another writer/schema. |
| 3. New event/image | Organizer publish → event API → public discovery | Accepted: Bandung Bakso Festival and its image appeared. Preserve publishing and image integration. |
| 4. Ticket totals, points and coupon | Customer → ticket selection → real wallet/quote → saved purchase | Accepted: 1 × Rp50,000 + 2 × Rp100,000 − 5,000 points = Rp245,000. Explain an empty coupon selection and link directly to the wallet. Referral coupons differ from event vouchers. |
| 5. Payment confirmation wording | Customer → check order → confirm → paid or fully discounted saved order | Show only the applicable explanation: payable orders need proof within two hours; free/fully discounted orders need no proof and are confirmed directly. |
| 6. Proof and status | Customer uploads → private Storage → Organizer reads → waiting for decision | Accepted by owner. Preserve actual upload, countdown, ownership and status transitions. |
| 7. Manual attendance action | Organizer approval → confirmed participant list → optional attendance action | Remove the confusing manual check-in control from the normal participant UI. Preserve existing attendance records/API and the independent optional Customer review checkbox. No barcode/check-in system is added. |
| 8. Referral issuance and wallet | Existing inviter code → new friend signup → point grant/coupon → checkout | Referral rewards are issued on a new signup, once per referred account, rather than after each purchase. Explain both recipients and coupon availability. No manual coupon transfer or purchase-triggered reward is added. |
| 9. Orders look static | Customer → My orders → saved detail → direct review | Add an explicit view-order affordance, focus/hover indication and clear Customer-only access states. |
| 10. Reviews and statistics | DONE purchase → Customer review → Organizer sees review/statistics | Accepted: new review, participant count and sales statistics work. Preserve saved reviews/terminal decisions. |
| 11. Recovery/profile | Referred Customer → emailed reset → login → rename | Owner accepted recovery and profile rename. Do not repeat a reset or change credentials. |

Read-only reconciliation confirms Xu Harga's original 10,000-point grant is now fully used and that this account has no incoming referral/coupon. Teman Sixu has one incoming referral and the Rp25,000 coupon restored by the earlier rejected purchase, valid until 10 February 2027. The Bandung order is DONE with three tickets, Rp250,000 subtotal, 5,000 points and Rp245,000 payable. No account, reward, purchase, review or attendance record is changed by this refinement.

## Scope and verification

The recorded project scope includes event vouchers, but the current temporary F2 connection supports referral coupons/points rather than event-voucher creation/redemption. Full voucher and event edit/delete/draft acceptance remain separate. A verbatim original assignment is not present in this repository; do not invent additional rubric requirements such as simultaneous per-tab logins, QR entry or purchase-issued referral coupons.

Use existing actual-runtime/browser regressions for Customer checkout, private proof, Organizer decision/participants and direct optional-attendance feedback. Extend those checks for Organizer preview isolation, explicit order links and role titles, plus long-reference transaction action layout. Cosmetic copy changes do not each need separate tests. Record fixture-based verification separately from owner screenshots and hosted read-only reconciliation.

Source and QA release status are recorded in PR #98 after its checks and deployment complete. This feedback record does not itself claim a new deployed release or full rubric acceptance.
