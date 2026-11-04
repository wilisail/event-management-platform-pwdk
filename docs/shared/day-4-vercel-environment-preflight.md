# Day 4 first check — Vercel environment preflight

Before starting Day 4 organizer decisions work, verify the Vercel environment setup. This is a review checklist only; do not paste secret values into the repo or companion notes.

- Confirm which Vercel project and deployment correspond to Preview and Production.
- In Project Settings → Environment Variables, check each backend credential's environment scope without copying its value. Preview should use non-production/test credentials and data; Production credentials should be scoped to Production.
- Confirm database connection settings point Preview to the intended non-production database and Production to the intended live database.
- Check that database passwords, Resend keys, and Supabase secret/service-role keys are server-only variables and are not exposed through `NEXT_PUBLIC_` names or client bundles.
- Review whether Preview deployments need Vercel Deployment Protection and whether Preview variables should be restricted to trusted branches.
- If any variable scope or value changes, redeploy before checking the deployment; existing deployments do not automatically receive changed environment variables.
- Record only the result and any follow-up needed. Never record secret values. If using a desktop SQL client later, use a non-production connection and a read-only database role.

After this preflight, proceed with the Day 4 organizer transaction/proof review, decision API and notification work in the completion plan.

## Security baseline — applies across the learning build

Treat security as a quality requirement even when the assignment rubric does not name it. At each stage, verify the behavior in code and configuration; do not claim the app is secure just because it uses standard tools.

- Keep secrets server-side, use separate Preview/test credentials, and grant database users only the access they need.
- Validate untrusted input on the server and enforce authentication, role, and record-ownership checks on every protected operation; frontend checks are not authorization.
- Store password verifiers and refresh-token/session material safely; support expiry, rotation, and revocation without logging or displaying raw credentials.
- Protect sensitive state changes such as payment decisions and inventory reservations with database transactions and clear audit records.
- Return safe errors, avoid leaking personal/payment/token data in logs, and test both allowed and denied access paths.
- Use read-only, non-production database access for manual inspection and learning exercises.

See the [optional tooling reference](optional-tooling-reference.md) for Learning Map experiments and provider comparisons.
