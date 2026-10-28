# Feature 2 database models

Updated: 28 October 2026.

This local schema mirrors `../../database/prisma/schema.prisma` so the feature 2 application can generate its own client without changing its standalone start commands. Keep the two schemas aligned when shared fields change.

The single ordered migration history is `../../database/prisma/migrations`; `prisma.config.ts` points there. The original user baseline is preserved in that folder. Do not start a second migration history or reset the shared database.

The event/ticket/purchase starter and 30 sample purchases are applied. See [shared database](../../database/README.md). Authentication, rewards and dashboard business logic remain feature 2 work.
