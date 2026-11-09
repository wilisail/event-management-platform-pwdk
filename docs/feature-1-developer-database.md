# Feature 1 developer database

9 November integration note: F1 commit `c497ddf` adds `20261108134857_feature_2_schema` to this independent developer history. It creates the account/referral/reward/attendance/outbox tables in that developer database after `initial_f1`. These tables already have their own shared migrations. Preserve this SQL's checksum; do not promote or replay the developer creation history onto the shared database. The Day 7 disposable harness verifies the two histories independently.

The schema adoption and developer SQL were merged into `integration` through [PR #42](https://github.com/wilisail/event-management-platform-pwdk/pull/42) after both CI workflows passed on 9 November. Verification used disposable databases and made no change to the hosted shared database.

The private `.env.rizky` handoff configures the F1 application and Prisma to use `temuevent_rizky_dev`. Prisma uses `temuevent_rizky_shadow` for temporary migration checks. Both databases are owned by Rizky's developer login in the existing TemuEvent Supabase project.

Pull the latest `feature-1` code and extract the private handoff into that checkout. It supplies `.env.rizky` and the existing public TLS certificate. Then use the usual commands:

```bash
npx prisma migrate dev --name initial_f1
npm run db:generate
npm run db:seed
npm run dev
```

After editing `prisma/schema.prisma`, run `npx prisma migrate dev --name describe_change`, followed by `npm run db:generate`. Development migrations are saved under `prisma/rizky-migrations`, using the F1 model and its separate shadow database. The seed includes the organizer UUID currently used by the create-event form.

The first development migration initializes this fresh database. It belongs to the development history. Later incremental changes can be shared as SQL and model changes for integration.

The developer login also owns the shared F1 `events`, `ticket_types`, `purchases`, `purchase_items` and `reviews` tables and the event/purchase enums. It has schema-create, user-reference and Prisma bookkeeping permissions. Apply incremental F1 SQL through the supplied shared connection with:

```bash
npm run db:shared -- --file path/to/incremental-migration.sql
```

Push the SQL and matching schema changes so the shared migration files and integration build reflect the changes. The Cloudinary `image_public_id` column is applied to the shared database. Its SQL file is in `feature-1-migrations` at `database/prisma/migrations/20261106021102_event_image_public_id/migration.sql`.

The existing shared application login remains the runtime account. Shared Prisma bookkeeping for the already-applied password-reset, review and poster-column changes was reconciled in the Day 6 follow-up; nine shared migration checksums were verified on 6 November. Independent F1 development uses its own history. A pushed migration file does not itself confirm that the private environment ZIP or a local migration run succeeded.

Keep `.env.rizky` private. The existing `.gitignore` already excludes it.
