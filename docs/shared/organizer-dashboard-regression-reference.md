# Day 5 Part 4 — Organizer dashboard regression

Updated 4 November 2026. Chromium ran the built Feature 2 app at desktop (1365 × 900) and phone (390 × 844) sizes. The browser used the real Next.js pages, Express routes, Prisma queries and persisted sessions against a disposable PostgreSQL database with all eight migrations replayed. The test created two organizers with events, an organizer with no events, and a customer. F1 destinations and ratings were served by a local test endpoint. A test transition recorded decisions and queued the outbox rows.

| Flow | What passed |
| --- | --- |
| Sessions and access | Signed-out visits go to login and resume the dashboard after sign-in. A customer sees the role restriction and gets HTTP 403 from the organizer API at both widths. A different organizer gets HTTP 404 when requesting another organizer's transaction. |
| Transactions | Status filtering and pagination work. Dismissing confirmation leaves the purchase unchanged. Confirmed approval and rejection update the detail and filtered list and each queue one decision email in the test database. Approval also refreshes the statistics. |
| Attendance | An event with no confirmed purchases shows the empty state. Dismissing confirmation creates no attendance record. Confirming marks both purchase rows for the same attendee using one record, which survives reload. |
| Statistics | Loading, injected HTTP 503, retry and the no-sales state render correctly. Daily, monthly and yearly grouping, the ticket metric and the numeric table work. A Rp75,000 approval moved the displayed revenue from Rp150,000 to Rp225,000. |
| Public links and ratings | Only published events show **Lihat event**. The public organizer and event links reach their expected routes. The F2 profile distinguishes a 4.5 average from zero reviews and an unavailable feed. **Buat event** stays hidden under the default configuration. |
| Responsive and keyboard | Neither viewport has page-level horizontal overflow. The phone transaction table scrolls inside its panel, including by arrow key when focused. Opening detail moves focus into it. Closing returns focus to the row button or to the status filter when the row has dropped out of the filtered list. |

**Fix from the regression.** Closing the detail from its bottom button left keyboard focus on the document body. The dashboard now restores focus to the control that opened it. After a decision removes that row from the current filter, it focuses **Status transaksi** so keyboard navigation can continue. The focused browser assertion failed before the fix and passed afterward.

**Verification.** TypeScript, the production build, all 141 application tests, and the isolated Day 4–5 database checks passed. Chromium passed the organizer and customer journeys at both viewport sizes, plus the empty-organizer and ownership checks. The organizer journeys reported no uncaught page errors.

**Day 6–7.** Repeat the release journey in combined Preview with F1 checkout, a real private proof and two organizers. Verify the real decision and timeout engine, applicable seat and reward restoration, and one actual email through the hosted executor. Compare the public links and ratings against F1 records, verify the F1 attendance requirement for submitting a review, and check the event-management ownership gates before enabling those links. Apply the earlier outbox and attendance migrations to the intended non-production database before hosted verification. Day 5.4 adds no migration, credential or provider.

**Learning checkpoint.** Approval changes the purchase, so the dashboard refreshes both the transaction list and the sales report. The report then recalculates from persisted `DONE` purchases. Attendance is a separate record, so one customer attending one event stays one attendance even if they bought tickets twice.

[Work schedule](feature-2-completion-plan.md) · [Statistics](organizer-statistics-reference.md) · [Attendance](organizer-attendance-reference.md) · [Public links](organizer-links-reference.md)
