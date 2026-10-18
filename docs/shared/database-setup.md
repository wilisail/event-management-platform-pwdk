# Database setup

Updated: 18 October 2026.

## Current project

| Setting | Value |
| --- | --- |
| Project | [temuevent](https://supabase.com/dashboard/project/rjjwjacihxepticquxxa) |
| Organization | wilisail's Org |
| Region | Singapore (`ap-southeast-1`) |
| Plan / creation quote | Free organization; project quoted at $0 per month |
| PostgreSQL | 17 |
| Application schema | `temuevent` |
| Initial table | `temuevent.users` |
| Database client | Prisma/client/adapter 7.10.1, pinned in feature 2 |

The project is active. The initial schema was applied through the Supabase connection and a customer and organizer were inserted. Supabase project access is separate from a running application's database connection.

## What each part does

| Part | Purpose |
| --- | --- |
| Supabase PostgreSQL | Stores the persistent tables and enforces constraints |
| Prisma schema and client | Describe the data and provide typed queries for the backend |
| Express API | Exposes application operations and will enforce user/organizer permissions |
| SQL baseline | Records the initial table, role, constraints and access policy |
| Development seed | Creates repeatable sample identities |

## Initial user schema and sample data

[Prisma schema](https://github.com/wilisail/event-management-platform-pwdk/blob/feature-2/feature-2/prisma/schema.prisma) · [SQL baseline](https://github.com/wilisail/event-management-platform-pwdk/blob/feature-2/feature-2/prisma/migrations/0_user_foundation/migration.sql) · [seed](https://github.com/wilisail/event-management-platform-pwdk/blob/feature-2/feature-2/prisma/seed.ts)

Users have a UUID, normalized unique email, name, customer/organizer role, immutable unique referral code, optional password hash/profile-picture key and timestamps. The seed identities have no login credentials; authentication is a subsequent feature 2 step.

| Development identity | Email | Role | Referral code |
| --- | --- | --- | --- |
| Ayu Pratiwi | `ayu@example.test` | `CUSTOMER` | `AYU7K2P` |
| Jakarta Coffee Collective | `organizer@example.test` | `ORGANIZER` | `JCCDEMO` |

The schema is backend-only. The Data API roles have no access to it; RLS is enabled. `temuevent_app` has schema/type usage and SELECT/INSERT/UPDATE on users, with a matching backend-role policy. It has no RLS-bypass or schema-creation privilege. A separate backend login password is configured privately, outside Git. The account/reward UI still uses its existing fixtures.

## Connect from a development machine

1. Check out `feature-2`, enter `feature-2/`, and run `npm ci` followed by `npm run db:generate`.
2. Put the backend database connection in the ignored `.env` file as `DATABASE_URL`. The [Connect panel](https://supabase.com/dashboard/project/rjjwjacihxepticquxxa?showConnect=true) provides the actual host. Use direct mode when IPv6 is available, or the displayed session-pooler endpoint for an IPv4-only network. For a pooler, the login name includes the project reference, for example `temuevent_app.rjjwjacihxepticquxxa`.
3. Keep the real application-role password in backend configuration. If TLS needs the project's root certificate, configure `DATABASE_CA_CERT_PATH` using the certificate from the dashboard. Keep certificate verification enabled.
4. Run `npm run db:check`. It must return the seeded customer from PostgreSQL.
5. For a local HTTP check, set `F2_DATABASE_CHECK_ENABLED=true`, run `npm run dev:api`, and request `http://127.0.0.1:4002/api/demo/database-check`. This diagnostic reads only the fixed development identity and is disabled by the entry point in production.

The password configured in this workspace is not published. A collaborator needs their own approved backend connection settings; the project URL or a publishable Data API key is not a PostgreSQL login password.

## Migration handoff

The hosted `user_foundation` SQL was applied through Supabase. The repository contains the equivalent `0_user_foundation` Prisma baseline. Before adding another Prisma migration, the integrator needs to record that existing baseline once, from a machine that can reach the database:

```sh
npx prisma migrate resolve --applied 0_user_foundation
npx prisma migrate status
```

Use an authorized migration connection in backend-only `DIRECT_URL`; the application role does not have DDL privileges. The Prisma config prefers `DIRECT_URL` for CLI work. This baseline-recording step is **pending**. Continue with one shared, ordered Prisma migration history after it is recorded; do not replay the initial creation SQL against the already initialized project.

## Verification and next scope

| Check | Result |
| --- | --- |
| Project status and managed SQL access | Passed |
| Customer and organizer seeded | Passed; two rows |
| Application-role read permission | Passed through a transaction-scoped role check |
| Email uniqueness and referral immutability | Passed with rollback-safe checks |
| Anonymous/Data API access | Denied; RLS enabled |
| Supabase security advisors | No findings at this checkpoint |
| Prisma generation and schema validation | Passed |
| TypeScript and API/domain tests | Passed; 22 tests |
| Live Express → Prisma → Supabase read | Pending; the Prisma client returned DNS error `EAI_AGAIN` in this workspace. The HTTP diagnostic returned a sanitized 503. |

Feature 2 continues with real registration, password hashing, sessions and referral/reward issuance. Feature 1 retains the design of its event/ticket/purchase/review tables. Shared foreign keys, reward allocations and the purchase transition service are coordinated before wiring the two features together. Approximately 30 linked sample transactions follow once the purchase schema aligns; they are not present yet.

Sources: [Supabase connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres), [Prisma baseline workflow](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/baselining).
