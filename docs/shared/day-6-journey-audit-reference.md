# Day 6 Part 3 — User journeys and requirement audit

Updated 4 November 2026. The isolated journey ran the built Feature 2 UI against its Express API and a disposable PostgreSQL database. All eight migrations were replayed and application queries ran as `temuevent_app`. A test adapter supplied checkout, proof metadata and the purchase state transitions. Feature 2 used its actual registration, sessions, reward, organizer, attendance and outbox code. The mail transport was simulated.

## Verified in the isolated journey

| Journey | Evidence |
| --- | --- |
| Mobile referral signup and login | At 390 px, a buyer registered with a referral code and signed in. The wallet showed the Rp25,000 platform coupon and 10,000 points earned after the buyer referred another account. The original referrer also received 10,000 points. |
| Checkout and resource accounting | A Rp100,000 fixture purchase held one seat, a Rp25,000 coupon and 5,000 points, leaving Rp70,000 payable. Replaying the same purchase ID kept the same reservation. Rejection, payment expiry at two hours and organizer cancellation at three days each restored the seat, points and coupon once. Approval consumed the reward claim and kept the seat booked. Event-voucher quota remains a combined F1 check. |
| Access and approval | The owner could read proof metadata without the object key. Another organizer got 404 on detail and decision attempts. A customer got 403 on the organizer API. The owning organizer approved the fixture purchase from the 1365 px desktop dashboard. |
| Email and reporting | The worker processed one approval and one rejection outbox job through the test transport. Repeating the worker call sent no duplicates. The organizer's report showed one confirmed purchase, one ticket and Rp70,000 in revenue. |
| Attendance and review eligibility | A `DONE` purchase alone left F2 eligibility false. The organizer marked attendance from the dashboard and eligibility became true for that buyer. The other customer stayed ineligible. |

The browser reported no uncaught page errors. TypeScript, the production build, all **144 tests**, and the Day 4–6.2 isolated regression suite also passed. The paid journey used proof metadata and a synthetic transition to test the shared boundary. Actual file upload, partner checkout, review submission and inbox receipt remain part of the combined Preview journey.

## Combined Preview gates

| Owner | What the audit found | Evidence required before marking complete |
| --- | --- | --- |
| F1 checkout and proof | At `7d072ba`, the ticket screen still shows a mock payment stage and the server exposes a read-only demo checkout context. | Sign in from checkout, retain the ticket selection, create a server-priced purchase with an eligible event voucher, coupon and points, then upload a real private proof. Verify the buyer and owning organizer can open it and another organizer cannot. Exercise the Rp0 path too. [Ticket screen](https://github.com/wilisail/event-management-platform-pwdk/blob/7d072ba631b96955c6d5b79e74c166aab3f07316/app/events/%5BeventId%5D/tickets/page.tsx#L154-L207) |
| Shared purchase transition | The local F2 decision route and reward/outbox services were exercised through the fixture adapter. | Run approval, rejection, expiry and cancellation through the shared engine. Compare the buyer and organizer states, test decision versus timeout in two database sessions, and reconcile the seat count, event-voucher quota and platform rewards. |
| F1 reviews | F1 has a review write route. It accepts `userId` from the request body and checks a `DONE` purchase. The browser uses a test identity. | Derive the reviewer from the shared session and check attendance server-side. Verify a paid buyer without attendance is refused, a marked attendee can review, a second review is refused, and the public rating reflects the first review. [Review route](https://github.com/wilisail/event-management-platform-pwdk/blob/7d072ba631b96955c6d5b79e74c166aab3f07316/server/app.ts#L340-L378) · [Eligibility query](https://github.com/wilisail/event-management-platform-pwdk/blob/7d072ba631b96955c6d5b79e74c166aab3f07316/server/database.ts#L386-L429) |
| Supabase and hosting | Owner migrations, live Cron activation and protected evaluator access remain follow-ups. | Run the Day 6.1 owner steps, verify live sign-in with both roles, enable the scheduled worker, and verify the actual inbox and persisted job state. GitHub Actions execution remains a separate 6.2 follow-up. [Day 6.1 owner steps](day-6-preview-deployment-reference.md) · [Day 6.2 follow-up](day-6-ci-worker-reference.md) |

The Day 4 isolation rerun checked that earlier decisions and outbox behavior survived the Day 6 release changes. Day 6.3 connects those pieces into a user journey and records where the evidence still depends on the partner implementation and hosted setup.

[Work schedule](feature-2-completion-plan.md) · [Shared journey and ownership](ux-reference.md)
