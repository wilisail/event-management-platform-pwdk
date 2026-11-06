# Day 6 Part 1 — hosted Feature 2 Preview

Updated 6 November 2026, Asia/Jakarta. The protected [Feature 2 Preview](https://temuevent-8jbtjn050-andor2.vercel.app/login) is READY. The F2 browser and Express API use the same origin. Hosted API verification passed using a temporary customer and two organizers.

| Item | Current state |
| --- | --- |
| Application | Account and organizer UI, password recovery, safe readiness check and scheduled email endpoint are deployed in Preview. |
| Database | All nine Prisma migrations are physically present and recorded with matching SQL checksums. The earlier reset/review ledger gaps are reconciled. Attendance and decision-email outbox migrations are applied. |
| Access controls | The checked private tables have RLS enabled. Hosted checks passed for customer 403, cross-organizer 404, owned purchase reads, statistics, attendance CSRF/ownership and logout. |
| Poster compatibility | The shared nullable `image_public_id` field is mirrored in F2. Rizky's Cloudinary helpers are an available F1 contribution; a complete purchase/proof journey remains separate. |
| Worker | Both email queues are enabled. Supabase Cron calls this specific protected Preview every minute using Vault-managed secrets. |
| QA cleanup | The three temporary QA accounts and their event, purchase, item, ticket, attendance, sessions and refresh tokens are removed. Separate demo data is not the disposable QA dataset. |

The previous owner migration/setup commands were pending on 4 November. They have now been completed and verified. Do not repeat `migrate resolve` or deploy creation SQL merely because an older companion says they are pending. Use the read-only operations check to inspect a fresh environment first.

The actual evaluator's access to Vercel protection and the intended demo logins still need confirmation. A developer's successful protected request does not prove the evaluator can open the link.

[Automated results and reusable operations](day-6-operations-reference.md) · [CI and executor](day-6-ci-worker-reference.md) · [Combined journey gates](day-6-journey-audit-reference.md) · [Submission handoff](day-6-submission-handoff-reference.md)
