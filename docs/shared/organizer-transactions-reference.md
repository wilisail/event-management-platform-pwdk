# Day 4 Part 1 — Organizer transaction reads and proof handoff

Updated 4 November 2026. The organizer dashboard and its read APIs are implemented in the local Feature 2 checkout. TypeScript and the production build passed for this checkpoint. The Feature 1 proof file and combined browser checks are still pending.

| Layer | Role |
| --- | --- |
| React dashboard | Lists transactions across six statuses with pagination and status filtering. Selecting a row loads ticket lines, recorded deductions, payable total, timestamps and proof upload status. |
| Express | Requires a valid session and the organizer role. Validates IDs and pagination. Transaction reads are uncached. |
| Prisma and PostgreSQL | The list, count and detail queries scope purchases to events owned by the signed-in organizer. Another organizer's purchase and an unknown purchase have the same 404 response. Prices are whole IDR values, checked for safe JSON conversion. |
| Private storage | The detail response includes the upload timestamp when present. It does not select or return the storage key or a file URL. |

**F1 handoff.** Agree on an authenticated file response or a short-lived signed URL issued after ownership is checked. Once a real test upload and the access interface are available, estimate 5–10 minutes to connect and 10–20 minutes to verify the owning organizer can open it and a second organizer cannot. Use the Day 6–7 integration window as needed. Public poster storage is separate.

**Learning checkpoint.** Why do the list, count and detail each check ownership in the backend query? A list filtered in the browser cannot protect a direct API request. Why is an upload timestamp safe to display while a raw file link needs a separate permission check? The timestamp describes the purchase. The link grants access to the file.

Implementation: `feature-2/components/organizer-dashboard.tsx`, `feature-2/server/protected-http.ts`, and `feature-2/server/organizer/read-repository.ts`. See the [decision companion](organizer-decision-reference.md) and [completion plan](feature-2-completion-plan.md).
