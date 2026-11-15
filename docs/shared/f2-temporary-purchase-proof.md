# Temporary F2 purchase/proof connection

Branch: `f2/temporary-purchase-proof-20261115`. Owner decision: 15 November 2026.

**Hosted update, 15 November 2026:** the tested application commit `d300edd2136d313719cc657dc236f78c1400f2e5` is live at the combined QA address. [Release evidence](f2-temporary-qa-release-2026-11-15.md) records actual private Storage, Gmail transport and scheduled-worker checks plus complete temporary-data cleanup. [Owner evaluation/UX tour](f2-qa-evaluation-tour-2026-11-15.md) is ready; owner acceptance remains pending.

## Purpose and lifetime

Provide a persisted Customer purchase and private-proof handoff so F2 can be evaluated as a complete journey: ticket selection -> saved purchase/reward reservation -> proof -> Organizer decision -> participants/wallet/email -> event feedback. This is temporary integration support owned by F2. It remains available as part of F2 until a compatible shared implementation is verified and deliberately replaces it. There is no automatic expiry, fallback to simulated orders, or second simultaneous purchase writer.

The branch name, server module and this record identify the temporary boundary. Product screens use normal Customer and Organizer wording. This record makes no assertion about another contributor's progress.

## Replaceable boundary

- Implementation: `feature-2/server/temporary-checkout/`; API contract: `feature-2/contracts/temporary-checkout.ts`.
- API: `POST /api/checkout/purchases`, `GET /api/me/purchases`, `GET /api/me/purchases/:id`, and `POST/GET /api/me/purchases/:id/proof`.
- Components: `feature-2/components/temporary-checkout.tsx` and `temporary-purchases.tsx`. Root ticket/transaction pages are small adapters to these components. The old transaction sample remains at the explicit `/transactions/preview` route, outside the saved purchase journey.
- Binding: `feature-2/server/runtime.ts` supplies the service to `temporaryCheckoutRouter` in the normal F2 app. A replacement must bind the same contract once, or migrate its callers and retained records together.
- No schema migration, second session authority, public proof bucket, manual status selector, or special Organizer decision path is introduced.

## Behavior and safeguards

Signed-in Customers choose a published future event's tickets and their own available referral coupon/points. The server locks the Customer, checks the idempotent purchase identity, then locks the event and ticket rows in a stable order. Prices and reward eligibility are calculated by the server and compared with the confirmed screen amounts. Purchase/items, seats and the existing F2 reward reservations commit together. An unchanged retry returns the existing purchase without another reservation; a changed cart or account is refused.

Paid purchases receive a database-clock two-hour deadline. Valid PNG/JPEG proof uploads are limited to 3 MiB, decoded and normalized to JPEG, and written to the existing private `payment-proofs` bucket with a generated path. Ownership, status and deadline are rechecked under the purchase lock before attaching the file and advancing to WAITING_FOR_ADMIN_CONFIRMATION with a three-day decision deadline. Unused uploads are compensated; uncertain commits do not delete an attached proof. The existing F2 Organizer decision, accounting, private-reader, participant, notification and scheduled-expiry services handle these same records. Free/fully discounted purchases become DONE atomically without proof.

Customers can reopen their saved purchases from **Pesanan saya**, refresh status, see a persisted proof and go directly from DONE to event feedback. The existing DONE-purchase/one-review rule and optional attendance checkbox remain. A same-account draft retains only cart and idempotency data in sessionStorage to reconnect an uncertain save. No token, password or proof bytes are stored there.

No bank credentials are invented. If all three server settings `F2_CHECKOUT_BANK_NAME`, `F2_CHECKOUT_ACCOUNT_NUMBER`, and `F2_CHECKOUT_ACCOUNT_NAME` are configured, their instructions are shown. Otherwise the page clearly says **Pembayaran uji** and asks for a test image with no real transfer. Private backend storage settings and the current scheduler remain necessary when hosting this branch.

## Other dependencies for acceptance

| Area | Current boundary / effect on F2 testing |
| --- | --- |
| Published event and tickets | Use a future published event with remaining seats. Past demo events remain evidence of earlier accepted outcomes, not candidates for another purchase. |
| Cloudinary poster | Existing creation/upload integration is retained. Browser publishing/image reload can be accepted separately from payment. |
| Referral points and reward coupons | This connection uses the real F2 wallet and reserve/consume/restore engine. These are supported in the purchase journey. |
| Organizer-created event vouchers | Voucher identity/quota reservation and restoration have no shared mapping in the current schema. This connection does not pretend to apply them. This remains separate from F2 referral coupons; full event-voucher acceptance remains outstanding. |
| Event editing/deletion and draft management | Separate event-management coverage; not required to exercise a newly published event through F2 payment decisions. Future changes must preserve existing purchase/seat accounting and ownership. |
| Reviews/Organizer rating | Existing real review APIs remain; confirmed Customer feedback does not request ticket selection or Organizer attendance. |
| Hosted release and worker | Combined QA now serves the tested commit. Private Storage readiness and the existing shared deadline worker passed fresh hosted checks. Owner screen acceptance remains separate from automated verification. |

## Verification and later owner tour

The added disposable PostgreSQL runner exercises actual F2 runtime sessions and routes, atomic purchase/reward/seat writes, proof privacy and failed-upload handling, normal approval/rejection, participants, optional-attendance reviews, deadline processing, zero-payable orders, and concurrent last-seat attempts. It uses memory storage/mail transports and one physical SQL connection; it does not claim hosted provider verification or independent-session stress testing.

The browser runner follows Customer ticket selection -> persisted purchase after reload -> proof after reload -> normal Organizer approval/participant list -> Customer DONE -> direct event review at 1280/360/320 px. It forwards real browser requests to the disposable runtime rather than synthesizing purchase success. CI runs both runners alongside existing checks. Current local evidence: 168 F2 tests, seven combined integration tests, eight new runtime scenario groups, nine existing final-B runtime groups, typechecks and production build passed. The local browser launch is restricted by workspace Chromium/socket permissions; CI browser completion is recorded with the PR checks.

The initial isolated verification changed no live records. The subsequent hosted verification created four temporary accounts, one event, five purchases and two reviews through normal APIs, uploaded three private proofs and sent two normal decision notifications to the owner's established test inbox via temporary Gmail aliases. The existing worker processed accelerated deadlines only on those test orders. All temporary records and physical proofs were removed; counts and full-row fingerprints of eleven original tables match the pre-test baseline. Provider acceptance is confirmed; actual receipt in the owner's inbox remains a manual check.

Full owner evaluation/UX testing now follows the ordered tour. Reuse accepted evidence and create fresh purchases for new decisions; do not reset or repeat existing terminal purchases/reviews. Choose a payable ticket for the proof/approval test, and test free/fully discounted tickets separately. Password recovery stays last.

Before replacement, rerun this consumer journey and the security/accounting checks against the proposed adapter, preserve existing purchase/proof references, and explicitly remove the previous binding. If no replacement is selected, retain this connection within F2.
