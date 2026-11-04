# Day 6 Part 2 — CI, readiness and scheduled email

Updated 4 November 2026. The release checks and worker endpoint are implemented. The new protected Preview built successfully. The scheduled endpoint is disabled there until the owner steps below are done. [Day 6.2 Preview](https://temuevent-npdasptr5-andor2.vercel.app/login)

| Check | Evidence |
| --- | --- |
| CI | The local `.github/workflows/feature-2-ci.yml` uses Node 22 and runs `npm ci`, typecheck, the test suite, a disposable database replay and the hosted-mode build. It has read-only repository permissions and takes no application secrets. The workflow parsed locally and its checks passed in the workspace. Automatic approval review blocked publication of the app and migration snapshot to a GitHub branch, so a GitHub Actions run remains pending. |
| Health and readiness | `/api/health` reports liveness. `/api/ready` checks the configured auth backend and runs a lightweight database query. It returns only `ready: true` or `ready: false`. It does not check that migrations are current. Responses use `Cache-Control: no-store`. |
| Scheduled email | `POST /api/internal/jobs/run` requires a dedicated bearer secret. It invokes the existing password reset and optional decision email workers. A queue scan failure produces HTTP 503. Logs include queue outcomes and duration, with no recipient addresses, tokens or message bodies. |
| Isolated check | A timer called the same route against a disposable PostgreSQL database with all eight migrations replayed. A simulated provider returned HTTP 429 on the first attempt and accepted both email jobs on the next tick. The worker recorded both accepted states with the same idempotency keys on retry. No browser or live mail provider was involved. TypeScript, the hosted build and all 144 tests passed locally. |

## Supabase follow-up for Wili

1. Run the [Day 6.1 owner commands](day-6-preview-deployment-reference.md) later. Record the already-applied reset and review migrations in Prisma, then apply the decision-email and attendance migrations. Share the final `prisma migrate status` output. Use the protected Preview to verify both demo roles afterward.
2. Configure a dedicated `F2_JOB_RUNNER_SECRET` in Vercel Preview using 32 random bytes in lowercase hex. Enable `F2_DECISION_EMAIL_WORKER_ENABLED=true` after the outbox migration and controlled sender are ready. Redeploy the reviewed Feature 2 build and verify its protected URL. Set the scheduler target to that specific deployment.
3. Use Supabase Cron to call the Preview once per minute. Save the exact endpoint URL, the matching bearer secret, and the approved Vercel automation bypass secret in Supabase Vault. The bypass header lets the request pass Vercel's protection. The separate bearer token authorizes the app's worker. [Supabase Cron](https://supabase.com/docs/guides/cron) · [Vercel automation header](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)
4. Verify an actual HTTP 200 and persisted queue progress using a controlled inbox. A successful `cron.job_run_details` row means Postgres submitted the request. Check the HTTP response and queue state separately. Check that the live job runs while the browser is closed. If the Preview is replaced, update the Vault URL and recheck the route.

After the owner steps and the secrets are configured, the Cron job can use the following SQL. The values come from Vault and stay out of the stored cron command and repository.

```sql
select cron.schedule('temuevent-preview-email-jobs', '* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'temuevent_preview_jobs_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'temuevent_preview_jobs_bearer'),
      'x-vercel-protection-bypass', (select decrypted_secret from vault.decrypted_secrets where name = 'temuevent_preview_jobs_vercel_bypass')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);
```

Supabase Cron fits this Preview because it can call a specific deployment every minute. Vercel Hobby Cron is daily, which exceeds the reset token's 15-minute lifetime. The reset request still starts its first pass after the browser response. Cron handles work that remains due and retries. Purchase expiry and reward restoration require the shared F1 transition and stay in the combined Day 6–7 test. [Vercel Cron plan limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)

[Work schedule](feature-2-completion-plan.md) · [Decision email outbox](organizer-decision-email-reference.md)
