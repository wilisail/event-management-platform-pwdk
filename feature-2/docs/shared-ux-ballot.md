# Shared UX ballot — draft for Sunday, 18 October 2026

Decision order: PRD → course implementation guidance → Rizky's accepted F1 prototype → official reference patterns → our project choices. Reference platforms are examples; their internal implementation is not inferred.

## Fixed by the PRD — not voting items

- Two roles, required customer accounts, protected pages and backend permissions.
- Six statuses: waiting for payment, waiting for admin confirmation, done, rejected, expired, canceled.
- Payment proof within two hours after checkout; cancellation if no organizer decision within three days.
- Referrer gets 10,000 points; referred registrant gets a coupon; rewards expire after three months.
- Applicable points/coupons/vouchers and capacity are restored on rejection, cancellation or expiry.
- IDR amounts, actual attendance before reviewing, responsive UI, confirmations, empty states, unit tests and SQL transactions for related writes.

The PRD does not specify coupon face value, discount stacking, the start of the three-day clock, or the exact attendance-verification UI.

## Already accepted

TemuEvent's name/theme and Rizky's visual direction are the UI baseline. PR #1 merges the existing Next.js prototype without editing F1 screens. F2's preview also uses Next.js/React/TypeScript and the matching Tailwind palette, while remaining separately runnable. The course's full-stack exercise used Vite; Next.js is present in other exercises and does not violate the supplied PRD. The Express API is kept separate. Production database/provider and deployment are still group decisions.

## Vote only on shared behavior

### 1. Login handoff

A. Browse/select tickets first; when checkout needs an account, login/register and return to the selected order. **Initial suggestion.**
B. Require login when the customer clicks “Pilih tiket,” before ticket selection.

Impact: F1B checkout needs either a retained selection/return target or an earlier gate; F2A auth must return the user to that target. A preserves exploration but needs a safe handoff. B is simpler but interrupts earlier. No guest purchase option because the PRD requires an account.

Reference: R1 recommends signing in before buying; R2 shows ticket selection followed by checkout. A is our proposed combination, not a claim that either platform uses this exact login-return behavior.

### 2. Combining discounts

A. Keep the prototype's voucher + platform coupon + points combination, with the server calculating the final total. **Initial suggestion to preserve the existing F1 interaction.**
B. One voucher OR one platform coupon, plus points; show the other discount as unavailable while one is active.

Impact: F1B checkout breakdown and rollback records; F2B eligible wallet/coupon data; F2C rejection needs the same restoration process. A keeps the preview interaction but requires testing combined discounts and their order. B reduces combinations but changes the preview interaction. The illustrated A order is voucher percentage, fixed coupon, then points, with a zero floor; this order is a proposal.

Reference: R3 demonstrates promo-code entry and event promotion concepts. It does not establish our stacking policy. Coupon Rp25,000 remains a demo value matching F1, pending agreement; it is not a PRD amount.

### 3. Free events and orders whose final payable amount is zero

A. No proof upload; create a confirmed/done registration and show it in the organizer attendee list. **Initial suggestion.**
B. No proof upload, but wait for organizer acceptance/rejection before confirming.

Impact: F1B payment/status screen; F2C decision queue, notification and attendee list. A avoids reviewing a nonexistent payment. B adds an approval step for free registrations. Both still need a real registration/purchase record and capacity accounting. Decide explicitly how the PRD's decision timeout applies if B is selected.

Reference: R4 documents free/no-payment orders and confirmation. Mapping those to our internal done status is our project decision.

### 4. Start of the three-day organizer decision clock

A. Start when payment proof is uploaded successfully, entering the confirmation stage. **Initial suggestion.**
B. Start when the initial checkout transaction is created.

Impact: F1B deadline/job fields and customer status; F2C dashboard decision deadline. A gives the organizer the full review window after proof exists. B can reduce that window by the payment-upload delay. The two-hour proof deadline remains fixed by the PRD. Three days = 72 hours is a proposed interpretation to agree.

Reference: exact timing comes from our PRD, not Ticketmaster/Eventbrite. R5 is only a reference for organizer order/status visibility.

### 5. Evidence that a customer attended before reviewing

A. Organizer manually marks attendance in the attendee list. **Initial suggestion for the learning-project scope.**
B. Code/QR check-in verified by the organizer.

Impact: F2C attendee UI/API records attendance; F1C checks that evidence before allowing a review; F2B organizer profile displays F1's rating summary. A is smaller to build. B adds ticket-code and scanning/verification work. Merely buying a ticket and waiting until the event ends is not proof of attendance.

Reference: R6 supports manual computer check-in; R7 documents app/QR check-in.

## Vote record — not filled on anyone's behalf

- Wili: 1*, 2*, 3*, 4*, 5\_
- Rizky: 1*, 2*, 3*, 4*, 5\_
- Agreement/date: pending.

No timeout or silence counts as agreement. Initial suggestions are draft choices only.

## Official references checked

- R1 Ticketmaster buying guidance: https://help.ticketmaster.com/hc/en-us/articles/9781745448977
- R2 Eventbrite checkout: https://www.eventbrite.com/help/en-us/articles/333111/what-does-the-checkout-process-look-like-with-eventbrite-payment-processing/
- R3 Eventbrite promo code entry: https://www.eventbrite.com/help/en-gb/articles/254822/how-to-apply-a-discount-or-access-code-to-your-order/
- R4 Eventbrite free/no-payment order types: https://www.eventbrite.com/help/en-us/articles/874192/how-to-add-attendees-manually/
- R5 LOKET order/status view: https://docs.loket.com/panduan/data-pemesanan
- R6 Eventbrite manual check-in: https://www.eventbrite.com/help/en-hk/articles/126937/how-to-use-a-laptop-to-check-in-attendees-at-your-event/
- R7 Eventbrite QR check-in: https://www.eventbrite.com/help/en-gb/articles/741083/how-to-check-in-attendees-at-the-event-with-eventbrite-organizer/

Some Eventbrite direct opens returned rate limits. Relevant official help excerpts were available in search results; unobserved behavior is not asserted.
