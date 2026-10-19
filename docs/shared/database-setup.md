# Database setup

Updated: 19 October 2026.

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
| Initial table | `temuevent.users` |
| Database client | Prisma/client/adapter 7.10.1, pinned in feature 2 |

The project is active. On 19 October 2026, a temporary cloud VM ran the repository's Node/Express backend and Prisma client against this database. Both `npm run db:check` and the Express HTTP diagnostic returned the seeded customer successfully. The connection verified Supabase's certificate chain and hostname. The initial Prisma migration baseline is recorded.

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

The alternative `DATABASE_CA_CERT_PATH` setting configures an explicit `pg` SSL object. Do not combine it with URL parameters `sslmode`, `sslcert`, `sslkey`, or `sslrootcert`, which can replace that SSL object. Prefer the verified startup-CA method above for the current runtime.

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

Continue with one shared, ordered Prisma migration history; Wili coordinates migration execution with schema changes from both builders.

## Feature 1 handoff

Readiness check: **19 October 2026**. The live Express → Prisma → Supabase path passed in a cloud VM, and the initial Prisma baseline is recorded. Local DNS restrictions did not require a database-provider change. Backend connection settings still need to be shared privately with Rizky; feature 1's own backend connection and event/purchase integration are separate next checks.

| Item | Available now | Remaining preparation |
| --- | --- | --- |
| Shared references | [UI](../ui/README.md), [UX](ux-reference.md), [technical reference](technical-reference.md) | Defaults remain open to input; changes affecting both features are recorded together. |
| User data | Customer and organizer development records in `temuevent.users` | Share backend connection settings privately. The feature 2 backend read passed in the cloud VM; Rizky verifies the connection from feature 1's backend. These records have no working login yet. |
| Database client | Prisma 7.10.1 schema, client setup and diagnostic commands on `feature-2` | The `feature-1` branch does not contain these commands. For a connection check, use a separate checkout of `feature-2` and its `feature-2/` folder; feature 1 keeps its own application code. |
| Migration history | Applied SQL and matching Prisma baseline are recorded; CLI status passed | Wili coordinates subsequent shared migrations with an authorized migration connection. Application credentials do not have permission to create tables. |
| Identity and rewards API | [Read-only demo contract](https://github.com/wilisail/event-management-platform-pwdk/blob/feature-2/feature-2/contracts/README.md) and fixture routes | Real authentication and reward persistence are feature 2 work. Demo headers and balances are not production identity or spend authorization. |
| Event and transaction data | PRD scope and cross-feature fields are in the technical reference | Rizky supplies his draft event/ticket/purchase schema or migration. Wili coordinates the user relationships, migration order and linked sample data. |

### Preparation owned by Wili

1. Share the verified backend connection settings privately. The seeded-user read and Express HTTP diagnostic have passed in the cloud VM. Keep real connection values outside the public repository.
2. Coordinate the next shared migrations with changes from both features. The initial baseline is already recorded.
3. Build feature 2 authentication and reward services against the shared contracts. Keep the current demo responses usable while the real services are added.
4. Prepare the approximately 30 linked sample transactions after the event/ticket/purchase structure aligns with feature 1.

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

Feature 2 continues with real registration, password hashing, sessions and referral/reward issuance. Feature 1 retains the design of its event/ticket/purchase/review tables. Shared foreign keys, reward allocations and the purchase transition service are coordinated before wiring the two features together. Approximately 30 linked sample transactions follow once the purchase schema aligns; they are not present yet.

Sources: [Supabase connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres), [Supabase SSL verification](https://supabase.com/docs/guides/platform/ssl-enforcement), [node-postgres SSL configuration](https://node-postgres.com/features/ssl), [Prisma baseline workflow](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/baselining), [Prisma PostgreSQL connection options](https://www.prisma.io/docs/orm/overview/databases/postgresql).
