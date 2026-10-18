# Validation — F2 prototype, 18 October 2026

Scope: new `feature-2/` folder only, based on the accepted F1 prototype merge `9802155fc2d1d1d3fcc09f768119602094a1f976`. No F1 application files were edited.

Completed:

- Next.js route type generation and TypeScript checking.
- 20 passing tests: reward expiry/month ends/leap years, available balances, account isolation, demo persona/role responses, public profile privacy, consistent errors, CORS and read-only routes.
- Next.js 16.4 production build.
- Browser checks against the production server and Express API: wallet data loads into the UI; referral view; local profile save confirmation; organizer persona; public organizer profile.
- Desktop visual inspection; 390px and 320px checks show no page-wide horizontal overflow; no browser page errors on the tested paths.

The browser and API ran together in a scoped local test process. Browser tooling/screenshots are temporary QA materials and are not project dependencies or submission assets.

Limits: no real authentication, SQL database, reward redemption/rollback, transaction approval, email delivery or hosted deployment was tested or claimed. Shared rules awaiting votes are listed in `shared-ux-ballot.md`.
