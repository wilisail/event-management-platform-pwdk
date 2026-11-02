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

## Day 6 learning plan — try Docker, runtime handling, async work and Redis

Use a small local exercise to see how Docker makes an app's runtime more reproducible across computers. Containerize the Erogine or TemuEvent learning API and, if practical, a local PostgreSQL database with Docker Compose. Run the same simple API/database check inside the containers and from the usual local setup; note what Docker standardizes and what still comes from environment variables, network/ports, volumes and the external Supabase/Vercel services.

Trace runtime handling separately: Node.js runs the backend process, Express receives/routes HTTP requests and applies error-handling middleware, and Vercel runs the deployed application functions. Axios is an HTTP client used by frontend code to call an API; it does not run or manage the server. Observe where an error is logged, what safe response reaches the caller, and how the service is restarted or invoked after deployment. A background job such as expiring reservations needs a scheduler or worker that actually runs; Redis alone does not provide that runtime.

Study JavaScript async behavior with one route that awaits database I/O and one intentionally slow CPU-bound task. Follow how the event loop can serve other requests while it waits for I/O, and how blocking synchronous or CPU-heavy work can delay every request in that Node.js process. Async/await makes asynchronous code easier to write; it does not by itself create a durable queue, schedule a future task, or make a database update safe from races.

Then sketch a queue-backed job for non-immediate work such as sending an order email or reconciling an uploaded payment receipt. Identify who enqueues it, which worker processes it, how retries/backoff and duplicate delivery are handled, and how failures are inspected. Compare a durable queue with an in-process timer: a timer can disappear when the process stops or redeploys. Do not move the authoritative order, payment, or stock decision into a queue; commit those state changes transactionally in PostgreSQL, then queue follow-up work.

Treat Redis as an optional experiment. If time allows, cache a frequently read product-list response, compare a cache miss with a cache hit, then change a product and verify the cached result is invalidated or refreshed. PostgreSQL remains the source of truth, especially for stock and order reservations. Skip Redis if it would distract from understanding the core API/database flow.

### Refresh-token storage comparison

TemuEvent's current setup stores hashed refresh-token/session records in PostgreSQL; Redis is not configured as the session store. Trace the existing login → refresh/rotation → logout/revocation path and identify which record is checked when a refresh token is presented. Do not display or copy raw tokens.

As a comparison exercise only, sketch how Redis could store a session identifier or token hash with a TTL, how logout/revocation would remove or invalidate it, and what happens to active sessions if Redis is unavailable or its data is lost. Compare expiry, durability, revocation, and operational dependencies with the current PostgreSQL approach. Do not migrate auth or add Redis just for this exercise; PostgreSQL remains the current session authority.

### TablePlus database inspection

Optionally use TablePlus as a desktop SQL client to inspect the non-production PostgreSQL schema and session-related tables. TablePlus is a manual database viewer/query tool; it does not host the database or replace Prisma, which is the application's database access layer. Start with read-only access and inspect table/column names and sample non-sensitive rows; do not edit or delete records, expose token material, or save/share production connection credentials. If TablePlus is unavailable, the Supabase dashboard or Prisma Studio can demonstrate the same database concepts.

Keep these as learning exercises. Do not point a container at Production or put production credentials in its image. The goal is to understand the difference between local containers and the hosted Vercel + Supabase deployment, not to add Docker or Redis to the production architecture.

## Day 7 integration check — traffic spikes and live updates

Use a ticket-launch scenario to discuss what happens when many buyers request a small inventory at once. A queue can smooth or defer background tasks such as emails, but it does not prevent overselling by itself. The stock reservation must be an atomic/transactional database operation with a clear conflict result; consider rate limits or a waiting room/backpressure, and record how a burst is observed. Make clear which work can wait and which request needs an immediate answer.

Trace one end-to-end journey through browser/client → deployed API/runtime → PostgreSQL/Supabase → response. Verify that both features use compatible identity, record/status rules and environment configuration. Exercise one success and one controlled failure; inspect the available logs. If a cache was added as a Day 6 experiment, confirm it cannot show stale price/stock data or bypass the database's authority.

For live availability or order progress, compare polling, Server-Sent Events (SSE), and WebSockets at a high level. Identify what message is sent, how clients reconnect, and how the server derives updates from persisted state. Treat countdowns and live counts as display hints; the database remains authoritative, and a timer in a browser does not release a reservation by itself.

Verify the current refresh-token path end to end: confirm a valid refresh can renew a session, a rotated/revoked token is rejected, and logout invalidates the session according to the database record. If a Redis alternative was only sketched, record it as a comparison—not as deployed infrastructure. Use TablePlus or another read-only client only against non-production data to inspect resulting session state; do not copy token secrets into the note.

Confirm any scheduled expiry/notification worker has an actual execution mechanism in the integrated deployment, and document its owner and trigger. If no worker or queue is configured, mark that behavior as pending instead of treating the timer shown in the UI as proof it runs.