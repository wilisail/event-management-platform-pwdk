# Proposed feature 1 ↔ feature 2 data contract

Status: proposed data contract. Read the shared [technical reference](https://github.com/wilisail/event-management-platform-pwdk/blob/main/docs/shared/technical-reference.md) for database/backend defaults and the [UX reference](https://github.com/wilisail/event-management-platform-pwdk/blob/main/docs/shared/ux-reference.md) for customer/organizer behavior. Defaults remain open to changes following input.

## Implemented registration backend

`POST /api/auth/register` on feature-2 accepts name, normalized email, password and an optional CUSTOMER/ORGANIZER role. It returns HTTP 201 with `data.user` using UserView fields and a generated referral code. Duplicate normalized emails return 409. Registration does not issue a session; the x-demo-persona header is not authentication.

Incoming `referralCode` is currently accepted only when empty/absent; nonempty input returns `REFERRAL_REGISTRATION_NOT_READY` without creating an account until rewards can commit atomically. See the [registration reference](https://github.com/wilisail/event-management-platform-pwdk/blob/main/docs/shared/registration-reference.md) for exact validation, response codes and verification.

## Try the read-only feature 2 data

Run `npm run dev` from `feature-2`. feature 2 web runs on 3001, Express on 4002. feature 1 can remain on 3000.

```sh
curl http://127.0.0.1:4002/api/demo/checkout-context -H 'x-demo-persona: customer'
curl http://127.0.0.1:4002/api/demo/organizers/demo-organizer-001
```

The first response has this shape (sample dates omitted here):

```json
{
  "success": true,
  "message": "Read-only data for the feature 1 checkout prototype",
  "data": {
    "user": {
      "id": "demo-customer-001",
      "role": "CUSTOMER",
      "name": "Ayu Pratiwi",
      "email": "ayu@example.test",
      "referralCode": "AYU7K2P",
      "profilePictureUrl": null
    },
    "rewards": {
      "userId": "demo-customer-001",
      "availablePoints": 20000,
      "currency": "IDR",
      "pointValueIdr": 1,
      "pointGrants": [],
      "coupons": []
    }
  },
  "meta": { "mode": "demo", "contractVersion": "0.1-proposal", "asOf": "ISO-8601 UTC" }
}
```

The running API returns real fixture arrays and expiry fields; `contracts/types.ts` is the complete type definition. `lib/api-client.ts` is an example consumer. Wallet `asOf` comes from the API, so the UI uses the same clock as the available balance.

## Proposed endpoints and ownership

| Demo route                     | feature 2 purpose                         | feature 1 consumer                            |
| ------------------------------ | ---------------------------------- | -------------------------------------- |
| GET /api/demo/me               | Safe user identity and role shape  | Signed-in header / purchase identity   |
| GET /api/demo/me/rewards       | Points and platform coupons        | Checkout reward picker                 |
| GET /api/demo/checkout-context | Combined identity + reward payload | Replace hardcoded checkout wallet data |
| GET /api/demo/organizers/:id   | Public organizer information       | Organizer profile/details link         |

These routes use a demo selector and fake `.test` accounts. **They are not real authentication or production permission enforcement.** The persona guard only illustrates the role-dependent response contract. In production, identity must come from the agreed authenticated session. Never trust a client-supplied role/user ID to authorize a purchase.

## Fixed rules and open decisions

- feature 2 defines referral award grants at 10,000 points and expiry at three calendar months, per PRD.
- Fixture coupons have three-month validity. Rp25,000 is kept as a demo amount to match feature 1; its face value is not specified by the PRD.
- UTC storage and Asia/Jakarta display are the current proposal. Month-end dates clamp to the final date of the target month; tests cover this. Confirm calendar/timezone semantics together before production.
- The shared UX reference supplies working defaults for discount combination/order, free/zero-total flow, decision deadlines, login handoff and attendance. This read-only preview does not yet implement the corresponding purchase/decision operations.
- Working default: restore rewards to their original grant/coupon with their original expiry; expired rewards remain unspendable. A reward valid at reservation can remain applied while awaiting review. The shared technical reference records this proposed rule and its effects on both features; real reservation/restoration is not implemented here.
- Schema names and IDs are proposed. The mock string IDs are not a mandate for the production primary-key type.

## Integration boundary

feature 1 owns purchase creation, payment-proof handling, timeouts and its purchase consistency rules. feature 2 owns account/reward issuance and the organizer decision UI/API. A proposed shared purchase transition/restoration service lets the feature 2 decision API use the same logic as feature 1's expiry jobs. Final service ownership/interface is not yet agreed.

For real checkout, purchase/item writes, inventory reservations and reward redemption must be coordinated atomically according to the PRD. Restore resources once when an action is retried or overlaps a timeout. Independent submissions can use separate databases/seed partner records, but the combined application needs one consistent authority for purchase/reward changes. The prototype makes no database writes and does not claim to satisfy production SQL transactions yet.

## Database planning only

Proposed feature 2 entities: users/profiles, referral registrations, point-grant batches, reward coupons, password-reset/session records, and redemption allocations linking to feature 1 purchase IDs. Event/purchase/review entities remain feature 1's domain. Agree cross-feature IDs, relations and migration ownership together. No Prisma provider or hosted database has been provisioned or selected by this push.
