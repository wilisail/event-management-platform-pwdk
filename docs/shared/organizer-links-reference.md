# Day 5 Part 3 — Event links and organizer ratings

Updated 4 November 2026. The public links and rating adapter are built in the local Feature 2 checkout. The organizer dashboard links to its own public profile and shows **Lihat event** on published events. The public profile links to the Feature 1 events and reviews page when the Feature 1 web origin is configured.

| Screen or API | How the parts connect |
| --- | --- |
| Organizer dashboard | The existing authenticated F2 list returns the signed-in organizer's events. Published rows link to F1's `/events/:eventId`. F1 also checks `PUBLISHED` when resolving a public event URL. |
| Public organizer profile | F2's `/organizers/:organizerId` uses its existing public identity and photo. The **Lihat event dan ulasan** link goes to the F1 organizer page for the same UUID. |
| Rating | F2's server requests F1's `/api/organizers/:organizerId`. F1 supplies reviews for that organizer's published events. F2 validates the ID and scores and returns just the average and count. A valid empty list displays **Belum ada ulasan**. An absent or unavailable feed displays **Ulasan belum tersedia**. |
| Event management | F1 already has `/organizer/events/new`. The branch inspected on 4 November sends a fixed development `organizerId`, and the API takes the owner from the request body. Keep **Buat event** hidden until F1 derives the owner from the shared session and checks the organizer role on the server. The inspected branch has no event edit route. |

The rating request times out after 2.5 seconds and sends no session credentials. F2 keeps the organizer's name and photo available even when F1 ratings cannot be loaded. It projects no review comments, reviewer names or account details. The request marker prevents a loop if the API origin points back to F2.

## Environment and remaining checks

| When | What to verify |
| --- | --- |
| Day 5.4 | Check the profile link, published and draft rows, and the rating, empty and unavailable states on desktop and phone. The initial API checks use a test transport with the F1 response shape. |
| Day 6–7 | Set `NEXT_PUBLIC_F1_ORIGIN` on the F2 web build to the intended F1 browser origin and `F1_PUBLIC_API_ORIGIN` on the F2 backend to the reachable F1 API origin. Follow the links in combined Preview, confirm both features use the same organizer UUID, and compare the displayed average/count with known F1 review rows. |
| After the F1 ownership fix | Verify a signed-in organizer can create an event under their own account and that a customer or forged organizer ID cannot create on someone else's behalf. Set `NEXT_PUBLIC_F1_MANAGEMENT_READY=true` on the F2 web build after that check. Add an edit link when F1 provides an owner-checked edit route. |

Day 5.2's attendance gate for submitting reviews remains a separate F1 write-path check. Day 5.3 adds no database migration, hosted service or credential. The intended Preview origins were left unconfigured in this checkpoint.

**Verification.** TypeScript, the production build and all 141 F2 tests passed. The new checks cover the aggregate returned by the real F2 profile route with a simulated F1 response, field projection, empty and invalid data, upstream failure, origin validation and recursion prevention.

**Learning checkpoint.** A link sends the visitor to another screen. Authorization belongs to the server receiving a create or edit request. F1 owns the review records and published-event filter. F2 reuses that result and exposes the two numbers its public profile needs.

[F1 create form](https://github.com/wilisail/event-management-platform-pwdk/blob/feature-1/app/organizer/events/new/page.tsx) · [F1 API](https://github.com/wilisail/event-management-platform-pwdk/blob/feature-1/server/app.ts) · [Work schedule](feature-2-completion-plan.md)
