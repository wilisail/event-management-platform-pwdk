# Day 6 Part 4 — Feature 2 submission handoff

Updated 4 November 2026. This handoff covers the standalone Feature 2 run, demo sequence and evidence. The protected Feature 2 Preview build reports `READY`. Hosted sign-in for the evaluator and the combined Feature 1 journey remain release checks. [Protected Feature 2 Preview](https://temuevent-npdasptr5-andor2.vercel.app/login)

## Run Feature 2 independently

Use Node 22.12+ and the current reviewed Feature 2 working snapshot. Reproducing this exact build from GitHub depends on the separate CI branch publication recorded in Day 6.2.

From the repository root, install dependencies and run the application and disposable-database checks.

```sh
(cd feature-2 && npm ci && npm run typecheck && npm test && npm run build)
(cd database && npm ci && node --import tsx scripts/verify-day4-isolated.mjs)
```

For the standalone UI, run `cd feature-2` and `npm run dev` in a separate terminal. Open `/preview` on `http://localhost:3001` for the sample UI. Its Express API runs on port 4002, and the browser reaches it at the same origin through the Next.js rewrite. The sample UI works without credentials. For actual registration and login, configure the intended non-production `DATABASE_URL` and a private `AUTH_JWT_SECRET` in `feature-2/.env` using `.env.example`. The intended database needs the shared migrations. Photo storage, password recovery and the scheduled worker use the separate settings in their companion notes. [Feature 2 README](https://github.com/wilisail/event-management-platform-pwdk/blob/feature-2/feature-2/README.md)

## Evaluator demo and evidence

| Order | What to show | Evidence or gate |
| --- | --- | --- |
| 1 | Sign in as a customer, open the referral and wallet tabs, and show the coupon and points. | Day 6.3 verified mobile signup, login and real referral ledger changes in a disposable database. Use the dedicated demo accounts once hosted sign-in is verified. |
| 2 | Sign in as the demo organizer, open the owned transaction, and show confirmed attendees and sales. | A separate organizer and a confirmed Rp150,000 purchase were prepared in Supabase. Verify that the hosted account can see its own data and a customer cannot access the organizer API. |
| 3 | Demonstrate approval, rejection, attendance and email through the isolated journey evidence. | Day 6.3 used a checkout adapter and simulated email. The live sequence depends on F1 checkout and proof, the shared transition, owner migrations, and the scheduled worker. |

Before handing over the protected link, confirm the evaluator can open it with their Vercel access and sign in to both app roles. Share the app demo credentials privately. Use the Day 6.1 and 6.2 notes for the database and worker setup, and the Day 6.3 note for the combined acceptance sequence. [Deployment and owner steps](day-6-preview-deployment-reference.md) · [CI and worker follow-up](day-6-ci-worker-reference.md) · [Journey evidence](day-6-journey-audit-reference.md)

The fresh local copy passed both dependency installs, TypeScript, all **144 tests**, the production build, all eight isolated migration replays, and the standalone `/preview` and same-origin API smoke checks.

## Presentation Q&A

| Question | Short answer |
| --- | --- |
| What does Feature 2 own? | Accounts and roles, referral rewards, the buyer wallet, and the organizer's transaction, attendee and sales views. Feature 1 owns discovery, event setup, ticket checkout, payment proof and review submission. |
| How do we protect organizer data? | The API derives identity from the session, then checks role and event ownership. The isolated test confirmed that a customer gets 403 and a second organizer gets 404 for another organizer's transaction. |
| How do rewards stay consistent? | The checkout reserves the coupon and exact point allocations in the same database transaction as the purchase. The final status tells the transition whether to consume or restore them. The outbox writes with the decision and retries independently. |
| What enables a review? | Feature 2 keeps attendance separate from the `DONE` purchase. The combined review API needs the verified session identity and that attendance check. |

## Feature 1 status at handoff

| Area | What was checked |
| --- | --- |
| Push and PR | `feature-1` is still at Rizky's `7d072ba`, **Add Event Review and others Revision**, dated 4 November. The shared repo showed zero open PRs. PR #1 was the merged UI baseline. PR #39 was the already-merged review-schema integration into Feature 2. [Latest F1 commit](https://github.com/wilisail/event-management-platform-pwdk/commit/7d072ba631b96955c6d5b79e74c166aab3f07316) · [PR #1](https://github.com/wilisail/event-management-platform-pwdk/pull/1) · [PR #39](https://github.com/wilisail/event-management-platform-pwdk/pull/39) |
| Schema | The F1 Prisma model includes `Voucher` and `Purchase.voucherId`. Its committed SQL migrations lack the voucher table and foreign key, and both are absent in the shared Supabase project. The shared `reviews` table is present. The F2 attendance and decision-email migrations remain pending under Day 6.1. [F1 Prisma schema](https://github.com/wilisail/event-management-platform-pwdk/blob/7d072ba631b96955c6d5b79e74c166aab3f07316/prisma/schema.prisma) |
| Cloud upload and hosting | The F1 event form creates a browser-local poster preview. I found no Cloudify or Cloudinary integration in the checked branch, and Vercel returned zero `feature-1` deployments in the connected `andor2` team. Confirm any deployment outside that team separately. [F1 poster handling](https://github.com/wilisail/event-management-platform-pwdk/blob/7d072ba631b96955c6d5b79e74c166aab3f07316/app/organizer/events/new/page.tsx#L219-L224) |

[Work schedule](feature-2-completion-plan.md)
