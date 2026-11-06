# Feature 1 developer migration access

Updated 6 November 2026.

Rizky has a named database login, `temuevent_rizky_migrator`, with an independently owned development database (`temuevent_rizky_dev`) and shadow database (`temuevent_rizky_shadow`) in the existing TemuEvent Supabase project. The supplied private environment file selects these connections in F1. The normal `npx prisma migrate dev` command uses `prisma/rizky-migrations`, starting from the F1 model.

The same login owns the shared F1 event, ticket-type, purchase, purchase-item and review tables plus the event/purchase enums. It can create schema objects, reference users, and read/insert/update Prisma migration records. It can apply incremental F1 SQL directly through `npm run db:shared -- --file ...`. SQL and matching model changes are pushed for shared-history reconciliation and integration testing. The existing runtime account remains `temuevent_app`.

The existing account/session/reward table owners remain `postgres`. The developer login has no global database-creation, role-creation, RLS-bypass or migration-record deletion privileges. Its two workspace databases are already created and owned by that login.

The optional `temuevent.events.image_public_id` text column is applied to the shared database. Its canonical SQL proposal remains on `feature-1-migrations` under `database/prisma/migrations/20261106021102_event_image_public_id`. Prisma reconciliation of the already-applied password-reset, review and poster changes remains an integration follow-up. Developer migration generation has its own complete history.

The public client setup is on `feature-1` at commit `13ec0d4`. See [the F1 developer guide](https://github.com/wilisail/event-management-platform-pwdk/blob/13ec0d464bf80a8f0fdac01619dc7155b06493e2/docs/feature-1-developer-database.md). The private environment and certificate are delivered outside Git.

Verification includes live scoped-role DDL and migration-record privilege checks with fixture rollback, live database ownership/catalog checks, both Prisma config validations, and isolated replay of native-Prisma-generated initial and incremental SQL against the F1 model. A hosted CLI connection/migration run remains to be checked from a network that resolves Supabase. This workspace returned DNS resolution errors.

On 19 October a Supabase Developer invitation was requested for Rizky. The retrieved conversation confirms that request and the private runtime-credential handoff, but it does not establish invitation acceptance. Dashboard membership and the database login used by Prisma are separate access paths.
