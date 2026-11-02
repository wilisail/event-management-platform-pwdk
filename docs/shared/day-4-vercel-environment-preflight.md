# Day 4 first check — Vercel environment preflight

Before starting Day 4 organizer decisions work, verify the Vercel environment setup. This is a review checklist only; do not paste secret values into the repo or companion notes.

- Confirm which Vercel project and deployment correspond to Preview and Production.
- In Project Settings → Environment Variables, check each backend credential's environment scope without copying its value. Preview should use non-production/test credentials and data; Production credentials should be scoped to Production.
- Confirm database connection settings point Preview to the intended non-production database and Production to the intended live database.
- Check that database passwords, Resend keys, and Supabase secret/service-role keys are server-only variables and are not exposed through `NEXT_PUBLIC_` names or client bundles.
- Review whether Preview deployments need Vercel Deployment Protection and whether Preview variables should be restricted to trusted branches.
- If any variable scope or value changes, redeploy before checking the deployment; existing deployments do not automatically receive changed environment variables.
- Record only the result and any follow-up needed. Never record secret values.

After this preflight, proceed with the Day 4 organizer transaction/proof review, decision API and notification work in the completion plan.