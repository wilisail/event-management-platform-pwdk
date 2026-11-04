# Day 6 Part 1 — Protected Preview and evaluator setup

Updated 4 November 2026. The Feature 2 source built successfully on Vercel as a protected Preview with its own URL. The existing team/project and eight Preview-scoped settings were reused. The deployment uses the same Express runtime as local development, served by Next at `/api` so the browser and API share an origin. [Feature 2 Preview](https://temuevent-hc9tohaqn-andor2.vercel.app/login)

| Check | Status |
| --- | --- |
| Build and runtime | Vercel reported `READY` and included `/api/[...path]`. The local hosted-mode smoke test exercised real login, secure cookies, PostgreSQL TLS, the organizer event list and statistics with query parameters, attendee reads, and a customer receiving HTTP 403 from the organizer API. |
| Request boundary | The adapter gives the raw body to Express and lets Express parse the query. It uses a single validated Vercel client IP on the Vercel deployment. The local smoke test confirmed that caller-supplied forwarding headers did not grant additional login attempts. Live ingress spoof testing remains open. |
| Demo data | Supabase contains a dedicated customer and two dedicated organizers, with a sample event owned by the primary demo organizer and a confirmed Rp150,000 purchase for two tickets. These are separate from the shared seed identities. Login credentials are kept out of the repository. |
| Preview access | Deployment metadata and build logs were verified. The authenticated HTTP fetch could not open the protected deployment from this connection, so hosted sign-in and evaluator access are still unverified. |
| Database | The reset and review tables already exist. Their corresponding Prisma history entries are missing. The decision-email and attendance tables are still pending. The separate migration branch includes their reviewed SQL files and shared schema mapping. |

## Owner step for the Preview database

Use the `temuevent` Supabase project. The migration table is owned by `postgres` and unavailable to the Preview runtime role. Use the owner or authorized migration connection locally as `DIRECT_URL`, with `schema=temuevent`, `sslmode=require`, `sslaccept=strict`, and `sslcert` set to the absolute path to `database/certs/prod-ca-2021.crt`. The [database connection note](database-setup.md) documents the direct and session-pooler options. Keep this connection in the local environment or ignored `database/.env`.

Get a fresh checkout containing the exact migration files.

```bash
git clone --single-branch --branch day6-preview-migrations https://github.com/wilisail/event-management-platform-pwdk.git temuevent-day6
cd temuevent-day6/database
npm ci
```

After configuring `DIRECT_URL`, confirm that `migrate status` identifies the `temuevent` schema and the expected project host. The first four migrations already match their recorded checksums. The live reset and review tables were checked for their constraints, indexes, policies, and grants. Mark those two already-applied migrations with Prisma so their creation SQL stays out of the next deploy. [Prisma reconciliation workflow](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/patching-and-hotfixing)

```bash
npx prisma migrate status
npx prisma migrate resolve --applied 20261101091039_password_reset_queue &&
npx prisma migrate resolve --applied 20261102094521_event_reviews
npx prisma migrate status
```

Once status lists only `20261104102134_organizer_decision_email_outbox` and `20261104105114_event_attendance` as pending, apply and recheck.

```bash
npx prisma migrate deploy && npx prisma migrate status
```

After the owner step, verify that all eight migration records are complete and both new tables are private and usable by the backend role. Then sign in to the protected Preview with both demo roles, check that the sample purchase appears only for its owning organizer, and confirm the evaluator's access separately. The scheduled worker is Day 6.2. F1 checkout, proof access, the shared decision engine, and live reviews remain part of the combined Day 6–7 test.

**Learning checkpoint.** A successful Vercel build confirms that the source can run on the host. The login and organizer checks prove that the hosted route, cookie, database connection and permissions work together. The Prisma ledger tells deployment which SQL has already run, so reconciling it is separate from creating tables.

[Migration branch](https://github.com/wilisail/event-management-platform-pwdk/tree/day6-preview-migrations/database) · [Work schedule](feature-2-completion-plan.md)
