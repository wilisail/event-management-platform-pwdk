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

## Day 6 learning plan — try Docker, runtime handling and Redis

Use a small local exercise to see how Docker makes an app's runtime more reproducible across computers. Containerize the Erogine or TemuEvent learning API and, if practical, a local PostgreSQL database with Docker Compose. Run the same simple API/database check inside the containers and from the usual local setup; note what Docker standardizes and what still comes from environment variables, network/ports, volumes and the external Supabase/Vercel services.

Trace runtime handling separately: Node.js runs the backend process, Express receives/routes HTTP requests and applies error-handling middleware, and Vercel runs the deployed application functions. Axios is an HTTP client used by frontend code to call an API; it does not run or manage the server. Observe where an error is logged, what safe response reaches the caller, and how the service is restarted or invoked after deployment. A background job such as expiring reservations needs a scheduler or worker that actually runs; Redis alone does not provide that runtime.

Treat Redis as an optional experiment. If time allows, cache a frequently read product-list response, compare a cache miss with a cache hit, then change a product and verify the cached result is invalidated or refreshed. PostgreSQL remains the source of truth, especially for stock and order reservations. Skip Redis if it would distract from understanding the core API/database flow.

Keep these as learning exercises. Do not point a container at Production or put production credentials in its image. The goal is to understand the difference between local containers and the hosted Vercel + Supabase deployment, not to add Docker or Redis to the production architecture.

## Day 7 integration check

Trace one end-to-end journey through browser/client → deployed API/runtime → PostgreSQL/Supabase → response. Verify that both features use compatible identity, record/status rules and environment configuration. Exercise one success and one controlled failure; inspect the available logs. If a cache was added as a Day 6 experiment, confirm it cannot show stale price/stock data or bypass the database's authority. Confirm any scheduled expiry/notification worker has an actual execution mechanism in the integrated deployment, and document its owner and trigger. If no worker is configured, mark that behavior as pending instead of treating the timer shown in the UI as proof it runs.
