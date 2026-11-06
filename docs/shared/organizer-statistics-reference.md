# Day 5 Part 1 — Organizer sales statistics

Updated 4 November 2026. The organizer dashboard shows daily, monthly and yearly views in the local Feature 2 checkout. The chart switches between ticket revenue and confirmed ticket quantity. The totals also show completed purchase count. A table exposes the exact figures per period.

| Layer | What it does |
| --- | --- |
| Express | Requires a signed-in organizer. The session supplies the organizer ID. The API rejects unknown query fields, future and reversed ranges, and ranges exceeding 93 daily, 36 monthly or 10 yearly periods. Responses are uncached. |
| PostgreSQL and Prisma | Filter owned `DONE` purchases by their stored completion instant. Group by Asia/Jakarta calendar boundaries. Sum ticket quantities per purchase before aggregating, so joining multiple ticket lines never multiplies revenue. Empty periods have zero totals. |
| Dashboard | The daily view defaults to 14 days, the monthly view to 12 months and the yearly view to 5 years, including the current period. Users can compare the chart and exact table. The dashboard reloads statistics after a decision refresh. |

**Metric definitions.** Revenue is the purchase's final `totalPrice` after deductions. Free confirmations add one completed purchase and their ticket quantities, with Rp0 revenue. Pending, rejected, expired and canceled purchases are excluded. Attendance is a separate record from confirmed ticket quantity. Date filtering uses inclusive WIB calendar dates, translated to a half-open timestamp range in PostgreSQL.

**Verification.** TypeScript and the production build passed. `database/scripts/verify-day4-isolated.mjs` also returned `DAY51_STATISTICS_OK` using synthetic records, the actual F2 HTTP API, Prisma and disposable PostgreSQL. It checked organizer scoping, role rejection, invalid dates, all three groupings and defaults, the WIB midnight boundary, a purchase with multiple ticket lines, free tickets and zero periods. The Day 4 checks still passed. The midnight fixtures supply explicit timestamp offsets so they test the report independently of the disposable database session timezone.

**Beyond local build.** Day 5.4 covers the dashboard's phone/desktop layout and visual states. Day 6–7 should drive a real F1 test checkout to `DONE`, inspect the recorded `completedAt` and final amounts, and compare Preview totals with the purchase and ticket records. Confirm the actual F1 writer preserves the intended completion instant at a WIB date boundary. Day 5.1 needs the existing database and Preview configuration only, with no migration or new provider. Shared data and hosting were not changed by this checkpoint.

**Learning checkpoint.** One order can have several ticket lines. Adding the order's price after joining those lines would count the price several times. Summing quantities at the order level first keeps the units clear. Using local midnight to choose buckets also keeps the chart aligned with what an organizer sees on the calendar, even if timestamps are stored in UTC.

Implementation: `feature-2/server/organizer/statistics.ts` and `feature-2/components/organizer-statistics.tsx`. See the [work schedule](feature-2-completion-plan.md).
