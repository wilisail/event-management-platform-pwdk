# Database setup

Updated: 1 November 2026.

## Referral/reward foundation

Five private tables are now applied: `referrals`, `point_grants`, `reward_coupons`, `reward_redemptions` and `point_allocations`, plus `RewardRedemptionStatus`. The shared and feature 2 Prisma models match. Migration `20261031212002_referral_rewards` is applied and recorded in the existing Prisma history with SHA-256 `95704ab3d474e68763438fcb14a69e54bc525e62e1ca1605adf1530d96470ea7`.

The [companion note](referral-reward-schema-reference.md) explains owner-bound relationships, earning batches, expiry, coupon exclusivity and remaining services. Live Prisma checks through the existing backend role passed; all QA writes rolled back. The original 2 users, 3 events, 4 ticket types and 30 purchases are preserved. Reward tables start empty; existing sample purchase discounts are illustrative and are not backfilled as real reward spending. Connection credentials and Data API exposure are unchanged.

Atomic incoming-referral signup is now implemented on `feature-2`, using these existing tables and credentials. The account, referral, 10,000-point award and newcomer coupon commit together; see the [signup companion note](referral-registration-reference.md). Authenticated wallet reading and purchase reward operations remain the next subparts. Temporary verification rewards roll back; real successful signups will persist their rewards.

## Account/session foundation

The shared schema now also includes `auth_sessions` and `auth_refresh_tokens`. These store per-login expiry/revocation and hashed refresh-token history. [Account/session notes](account-session-foundation.md) describe the fields, relationships, course mapping and verification.

Both tables are private, RLS-enabled and accessible to the existing backend role through SELECT/INSERT/UPDATE only. The additive `20261031041038_account_sessions` migration is applied and registered in Prisma history with its exact SQL checksum. Registration, login/session/cookie handling, refresh and logout are implemented on feature-2. [Reusable guards, protected identity and owned organizer reads](authorization-reference.md) passed real HTTP/database tests; [connected frontend authentication](frontend-authentication-reference.md) also passed the real HTTPS client/service flow. QA writes roll back; existing sample data is unchanged. No migration, grant or connection-secret change is needed for this frontend checkpoint.

The ignored backend environment now uses the existing DATABASE_URL plus AUTH_JWT_SECRET for login sessions. A development signing key is prepared in the private handoff; the database connection/password is unchanged. Never copy either value into Git or frontend public variables. This batch requires no new migration, database account or permission grants.

## Ready-to-use event and purchase starter

The shared database now has `users`, `events`, `ticket_types`, `purchases` and `purchase_items` in the `temuevent` schema. Three events, four ticket types and thirty linked demo purchases are inserted, five in each required transaction status. One DONE purchase has a zero total.

The [shared Prisma starter](../../database/README.md) contains the models, pinned dependencies, public TLS certificate, connection example, ordered migrations and repeatable sample-data SQL. Rizky can bring the `database` folder into feature-1, place the already supplied .env there, and run the documented check. Prisma reads and rolled-back writes with those existing credentials passed in a cloud VM on 28 October.

Event fields follow Rizky's current creation form. The starter is available immediately, and its fields remain open to changes from either builder. Feature 1's frontend/backend implementation remains with Rizky. Payment-proof keys in the demo data are placeholders; real rewards/uploads/purchase-transition services and their authorization still need implementation. Account/organizer read guards are already implemented separately.

## Parallel development and handoff

Feature 1 can continue its screens, backend handlers and business-rule tests using sample data while feature 2 continues authentication, rewards and dashboard work against the shared contracts. Each builder keeps their own feature implementation.

The database connection is ready when either backend is ready to use it. The [standalone checker](database-check/README.md) is optional; a successful read through a feature's own backend is also a connection check. The actual application credentials are supplied outside this public repository.

A draft event/ticket/purchase model is enough to coordinate shared user relationships and migrations before the whole feature is finished. Connecting the backend, applying the agreed migrations and inserting linked sample data are separate from building the screens; the connection file does not perform those steps automatically.

For coding agents: inspect the builder's current work and the [technical reference](technical-reference.md), then explain which parts use sample data, which use the database, and the next integration step. The existing connection check does not require replacing either feature's application structure.

## Current project

| Setting | Value |
| --- | --- |
| Project | [temuevent](https://supabase.com/dashboard/project/rjjwjacihxepticquxxa) |
| Organization | [Pwdk's Org](https://supabase.com/dashboard/org/ypcxqntkrrelxfijcedb/general) |
| Team members | [Organization members](https://supabase.com/dashboard/org/ypcxqntkrrelxfijcedb/team) |
| Region | Singapore (`ap-southeast-1`) |
| Plan / creation quote | Free organization; project quoted at $0 per month |
| PostgreSQL | 17 |
| Application schema | `temuevent` |
| Application tables | `users`, `events`, `ticket_types`, `purchases`, `purchase_items`, `auth_sessions`, `auth_refresh_tokens` in `temuevent` |
| Reward tables | `referrals`, `point_grants`, `reward_coupons`, `reward_redemptions`, `point_allocations` in `temuevent` |
| Database client | Prisma/client/adapter 7.10.1, pinned in the shared `database` package and feature 2 |

The project is active. On 19 October 2026, a temporary cloud VM ran the repository's Node/Express backend and Prisma client against this database. Both `npm run db:check` and the Express HTTP diagnostic returned the seeded customer successfully. The connection verified Supabase's certificate chain and hostname. The initial Prisma migration baseline is recorded.

## Shared connection check

The [connection-check folder](database-check/README.md) contains the runnable checker, locked dependencies, public Supabase CA, `.env.example` and setup instructions. It can be used independently of either feature's application. These scripts passed an authenticated, certificate-verified cloud database read on 19 October 2026.

The actual application `.env` is prepared separately for Rizky and contains the database password. Keep that file and the private handoff ZIP outside the public repository. Dashboard membership does not supply the application password. Once the supplied `.env` is in the checker folder, run `npm ci` and `npm run check`; neither feature needs to be submitted first.

## What each part does

| Part | Purpose |
| --- | --- |
| Supabase PostgreSQL | Stores the persistent tables and enforces constraints |
| Prisma schema and client | Describe the data and provide typed queries for the backend |
| Express API | Exposes application operations and will enforce user/organizer permissions |
| SQL baseline | Records the initial table, role, constraints and access policy |
| Development seed | Creates repeatable sample identities |

## Initial user schema and sample data

[Prisma schema](https://github.com/wilisail/event-management-platform-pwdk/blob/feature-2/feature-2/prisma/schema.prisma) · [SQL baseline](https://github.com/wilisail/event-management-platform-pwdk/blob/main/database/prisma/migrations/0_user_foundation/migration.sql) · [seed](https://github.com/wilisail/event-management-platform-pwdk/blob/feature-2/feature-2/prisma/seed.ts)

Users have a UUID, normalized unique email, name, customer/organizer role, immutable unique referral code, optional password hash/profile-picture key and timestamps. The seed identities have no login credentials. Register a new account to test the implemented password login and connected pages; a new organizer will initially have no owned events. Evaluator/demo account setup is a separate release task.

| Development identity | Email | Role | Referral code |
| --- | --- | --- | --- |
| Ayu Pratiwi | `ayu@example.test` | `CUSTOMER` | `AYU7K2P` |
| Jakarta Coffee Collective | `organizer@example.test` | `ORGANIZER` | `JCCDEMO` |

The schema is backend-only. The Data API roles have no access to it; RLS is enabled. `temuevent_app` has schema/type usage and SELECT/INSERT/UPDATE on users. It also has SELECT/INSERT/UPDATE/DELETE on events and ticket types, and SELECT/INSERT/UPDATE on purchases and purchase items, with matching backend-role policies. Purchase history cannot be deleted through this application role. It has no RLS-bypass or schema-creation privilege. A separate backend login password is configured privately, outside Git. The account/reward UI still uses its existing fixtures.

## Verified connection

| Setting | Value |
| --- | --- |
| Mode | Shared session pooler |
| Host | `aws-0-ap-southeast-1.pooler.supabase.com` |
| Port / database | `5432` / `postgres` |
| Application login through pooler | `temuevent_app.rjjwjacihxepticquxxa` |
| Runtime TLS | `sslmode=verify-full`, with the Supabase Root 2021 CA trusted by Node |

These are connection identifiers, not a password. The application password stays in backend-only configuration.

## Connect from a development machine or cloud VM

1. Check out `feature-2`, enter `feature-2/`, and run `npm ci` followed by `npm run db:generate`.
2. Put the backend database connection in the ignored `.env` file as `DATABASE_URL`. The [Connect panel](https://supabase.com/dashboard/project/rjjwjacihxepticquxxa?showConnect=true) provides the actual host. Use direct mode when IPv6 is available, or the displayed session-pooler endpoint for an IPv4-only network. For a pooler, the login name includes the project reference, for example `temuevent_app.rjjwjacihxepticquxxa`.
3. Keep the application-role password in backend configuration. Download the CA from the dashboard's Database Settings → SSL configuration. The verified root certificate is [Supabase Root 2021 CA](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt), also linked by Supabase Studio. Its SHA-256 fingerprint is `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.
4. Keep `sslmode=verify-full` in the runtime URL and supply the trusted CA before Node starts:

   ```sh
   NODE_EXTRA_CA_CERTS=/absolute/path/to/prod-ca-2021.crt npm run db:check
   ```

   This command returned the seeded customer in the cloud VM. Set `NODE_EXTRA_CA_CERTS` in the process/hosting environment; putting it only in a file loaded later by `dotenv` does not configure Node's startup trust store. Certificate verification remains enabled.
5. For the HTTP check, set `F2_DATABASE_CHECK_ENABLED=true`, start `npm run dev:api` with the same CA environment setting, and request `http://127.0.0.1:4002/api/demo/database-check`. It returned HTTP 200 with the seeded customer in the cloud VM. This diagnostic is disabled by the entry point in production.

The current feature 2 backend now defaults to an explicit verified `pg` SSL object using the included public CA and system roots. It removes URI SSL options before supplying that object so they cannot replace it. DATABASE_URL alone therefore enables its database access; NODE_EXTRA_CA_CERTS is not additionally required by that helper. DATABASE_CA_CERT_PATH remains an optional CA override. The startup-CA instructions above remain useful for a separate backend that does not adopt this helper.

WSL and a laptop are optional execution environments. The cloud VM performed these checks without either. The temporary VM has stopped; it was a verification run, not a deployed website or running shared API.

The password configured in this workspace is not published. A collaborator needs their own approved backend connection settings; the project URL or a publishable Data API key is not a PostgreSQL login password.

## Migration handoff

The hosted `user_foundation` SQL was applied through Supabase. The matching `0_user_foundation` baseline was recorded on 19 October 2026 with the Prisma CLI in the cloud VM. These commands have already completed successfully:

```sh
npx prisma migrate resolve --applied 0_user_foundation
npx prisma migrate status
```

`prisma migrate status` reported one migration and an up-to-date migration history. This checks migration history, not full schema drift. Do not replay the initial creation SQL or repeat the baseline step against the initialized project.

Future migrations use an authorized migration connection in backend-only `DIRECT_URL`; the application role has no schema-creation privilege. The Prisma config prefers `DIRECT_URL` for CLI work. For this Prisma CLI version, the verified migration URL used `schema=temuevent&sslmode=require&sslaccept=strict&sslcert=/absolute/path/to/prod-ca-2021.crt`. These native CLI certificate options differ from the Node `pg` runtime options.

The one-time baseline login is now disabled, its password removed, and its temporary permissions revoked. `temuevent._prisma_migrations` is owned by `postgres`, has RLS enabled, and grants no access to the application or Data API roles. A security-advisor INFO notice for RLS without policies is expected here: the migration-history table intentionally denies those roles. No application data was deleted.

Continue with one shared, ordered Prisma migration history at `database/prisma/migrations`; Wili coordinates migration execution with schema changes from both builders. The original `0_user_foundation` file and checksum are preserved. The additive `20261028090000_event_purchase_starter` SQL is applied and registered in Prisma history with its matching checksum.

## Feature 1 handoff

Readiness check: **19 October 2026**. The live Express → Prisma → Supabase path passed in a cloud VM, and the initial Prisma baseline is recorded. Local DNS restrictions did not require a database-provider change. The [independent connection checker](database-check/README.md), public CA and environment template are available on `main`. The actual application connection file is prepared for direct handoff to Rizky and excluded from GitHub. Feature 1's own backend connection and event/purchase integration remain its next checks.

| Item | Available now | Remaining preparation |
| --- | --- | --- |
| Shared references | [UI](../ui/README.md), [UX](ux-reference.md), [technical reference](technical-reference.md) | Defaults remain open to input; changes affecting both features are recorded together. |
| User data | Customer and organizer development records in `temuevent.users` | Share backend connection settings privately. The feature 2 backend read passed in the cloud VM; Rizky verifies the connection from feature 1's backend. These records have no working login yet. |
| Database client | Prisma 7.10.1 setup on `feature-2`; [independent connection checker](database-check/README.md) with the public CA and environment template on `main` | Use the independent checker with the supplied application `.env` in a separate checkout or temporary folder. Feature 1 keeps its own application code and configures its own backend connection. |
| Migration history | Applied SQL and matching Prisma baseline are recorded; CLI status passed | Wili coordinates subsequent shared migrations with an authorized migration connection. Application credentials do not have permission to create tables. |
| Identity and rewards API | [Read-only demo contract](https://github.com/wilisail/event-management-platform-pwdk/blob/feature-2/feature-2/contracts/README.md) and fixture routes | Real authentication and reward persistence are feature 2 work. Demo headers and balances are not production identity or spend authorization. |
| Event and transaction data | Live event/ticket/purchase starter plus 30 linked demo purchases | Rizky can connect now using the shared models, then propose field changes from feature 1. Wili coordinates shared relationships and migrations. |

### Preparation owned by Wili

1. The verified application connection file and TLS certificate are prepared for Rizky. Forward the actual `.env` outside the public repository; the [checker and instructions](database-check/README.md) are available on GitHub. The independent checker, seeded-user read and Express HTTP diagnostic have passed in cloud VMs.
2. Coordinate the next shared migrations with changes from both features. The initial baseline is already recorded.
3. Build feature 2 authentication and reward services against the shared contracts. Keep the current demo responses usable while the real services are added.
4. The 30 linked sample purchases are now inserted. Coordinate any fixture/model changes with feature 1; the seed inserts missing demo records without resetting other data.

### Input from Rizky

Share a draft of the event, ticket and purchase tables/models when available, including their customer/organizer user links. The builder retains control of feature 1's internal fields, routes and code structure. Existing user foreign keys reference UUID `temuevent.users.id`; customer and organizer are roles on that table. Seed scripts can look up the development users by email instead of hardcoding generated UUIDs.

Feature 1 can continue its pages, API handlers and business-rule tests using the current contracts and fixtures. The first database integration check is an event linked to the seeded organizer and readable through the feature 1 backend. Real checkout follows once purchase creation and reward operations can share one SQL transaction.

## Verification and next scope

| Check | Result |
| --- | --- |
| Project status and managed SQL access | Passed |
| Customer and organizer seeded | Passed; two rows |
| Application-role read permission | Passed through a transaction-scoped role check |
| Email uniqueness and referral immutability | Passed with rollback-safe checks |
| Anonymous/Data API access | Denied; RLS enabled |
| Supabase security advisors | One INFO notice: migration history intentionally has RLS without public policies; no warning/error findings |
| Prisma generation and schema validation | Passed |
| TypeScript and API/domain tests | Passed; 22 tests |
| Live Express → Prisma → Supabase read | Passed in the cloud VM; HTTP 200 with the seeded customer and TLS certificate verification enabled |
| Prisma migration baseline | Passed; `0_user_foundation` recorded and CLI migration status up to date |
| Temporary baseline login | Disabled; password and temporary privileges removed |

Feature 2 registration, optional atomic referral/reward issuance, password hashing, sessions, protected reads and frontend auth are implemented. Next are the authenticated wallet and remaining [completion-plan](feature-2-completion-plan.md) flows. Feature 1 retains the design of its event/ticket/purchase/review implementation. Reward allocations and the purchase transition service are coordinated before checkout integration. Thirty linked sample purchases remain present in the shared database.

Sources: [Supabase connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres), [Supabase SSL verification](https://supabase.com/docs/guides/platform/ssl-enforcement), [node-postgres SSL configuration](https://node-postgres.com/features/ssl), [Prisma baseline workflow](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/baselining), [Prisma PostgreSQL connection options](https://www.prisma.io/docs/orm/overview/databases/postgresql).

