# Feature 2 — account and reward prototype

A separately runnable F2 prototype matching Rizky's accepted TemuEvent visual direction. The existing F1 application at the repository root is not edited by this module.

## Run

Requires Node 22.12+ and npm. From the repository root:

```sh
cd feature-2
npm ci
npm run dev
```

- F2 UI: http://localhost:3001
- Read-only Express demo API: http://127.0.0.1:4002/health
- Run the existing F1 app separately on port 3000 if you want its discovery link to work.
- No database, service account, password, or API key is required for this preview.

The defaults run without an environment file. `.env.example` documents optional overrides. Export those variables in your terminal if needed; the demo Express process does not automatically read `.env`.

## What works in this preview

- Customer and organizer **demo persona** selection; this is not authentication.
- Account profile UI, immutable referral-code display/copy, and a local profile-edit confirmation dialog.
- Reward wallet loaded from the Express API, including active/expired point grants and coupons.
- Public organizer profile, with an empty review/rating slot for the F1 review module.
- Typed proposed F1/F2 data shapes in `contracts/types.ts`.
- Referral-grant and calendar-expiry functions with tests; no rewards are actually issued or redeemed.
- Read-only checkout-context response that F1 can inspect without changing its current prototype.

The fixtures match F1's example of 20,000 points and `WELCOME25`. **The Rp25,000 coupon amount is a demonstration value, not a settled product rule.** Expired samples are shown for empty/error-state work.

## Validation

```sh
npm run typecheck
npm test
npm run build
```

Next.js type errors are not suppressed. The tests cover expiry boundaries, leap/month-end dates, user-data isolation, role restrictions in demo routes, CORS, and the checkout data shape.

## What remains before a graded submission

Actual registration/login, password hashing and sessions, real backend authorization, database persistence/Prisma migrations, atomic referral issuance, avatar uploads, password change/reset emails, organizer management/statistics/attendee APIs, and purchase decisions are not implemented by this preview. PRD-required SQL transactions will be needed for real multi-record writes.

The `x-demo-persona` header is deliberately only a demo selector. Production identity must come from the agreed authenticated session, never from a caller-supplied user ID or role.

Pending shared votes: login handoff, discount combinations, zero-payment orders, start of the three-day decision window, and attendance evidence. See `docs/shared-ux-ballot.md`.

## Ownership

- F1 author: Rizky; event discovery/creation, purchasing/vouchers, reviews.
- F2 author: Wili; accounts/rewards/profiles/dashboard. This initial F2 implementation is agent-assisted.
- Theme and product name: adopted from Rizky's F1 prototype, commit `cd582753a480d68ce14e00021a52f8ec93d8372f`.
- This folder contains F2's own frontend, demo backend, contracts, tests, and run instructions. Reusing the theme does not transfer F1 authorship.
