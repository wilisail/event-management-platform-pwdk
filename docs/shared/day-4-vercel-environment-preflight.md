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

## Day 6 learning plan — try Docker, runtime handling, async work and Redis

Use a small local exercise to see how Docker makes an app's runtime more reproducible across computers. Containerize the Erogine or TemuEvent learning API and, if practical, a local PostgreSQL database with Docker Compose. Run the same simple API/database check inside the containers and from the usual local setup; note what Docker standardizes and what still comes from environment variables, network/ports, volumes and the external Supabase/Vercel services.

Trace runtime handling separately: Node.js runs the backend process, Express receives/routes HTTP requests and applies error-handling middleware, and Vercel runs the deployed application functions. Axios is an HTTP client used by frontend code to call an API; it does not run or manage the server. Observe where an error is logged, what safe response reaches the caller, and how the service is restarted or invoked after deployment. A background job such as expiring reservations needs a scheduler or worker that actually runs; Redis alone does not provide that runtime.

Study JavaScript async behavior with one route that awaits database I/O and one intentionally slow CPU-bound task. Follow how the event loop can serve other requests while it waits for I/O, and how blocking synchronous or CPU-heavy work can delay every request in that Node.js process. Async/await makes asynchronous code easier to write; it does not by itself create a durable queue, schedule a future task, or make a database update safe from races.

Then sketch a queue-backed job for non-immediate work such as sending an order email or reconciling an uploaded payment receipt. Identify who enqueues it, which worker processes it, how retries/backoff and duplicate delivery are handled, and how failures are inspected. Compare a durable queue with an in-process timer: a timer can disappear when the process stops or redeploys. Do not move the authoritative order, payment, or stock decision into a queue; commit those state changes transactionally in PostgreSQL, then queue follow-up work.

Treat Redis as an optional experiment. If time allows, cache a frequently read product-list response, compare a cache miss with a cache hit, then change a product and verify the cached result is invalidated or refreshed. PostgreSQL remains the source of truth, especially for stock and order reservations. Skip Redis if it would distract from understanding the core API/database flow.

Keep these as learning exercises. Do not point a container at Production or put production credentials in its image. The goal is to understand the difference between local containers and the hosted Vercel + Supabase deployment, not to add Docker or Redis to the production architecture.

## Day 7 integration check — traffic spikes and live updates

Use a ticket-launch scenario to discuss what happens when many buyers request a small inventory at once. A queue can smooth or defer background tasks such as emails, but it does not prevent overselling by itself. The stock reservation must be an atomic/transactional database operation with a clear conflict result; consider rate limits or a waiting room/backpressure, and record how a burst is observed. Make clear which work can wait and which request needs an immediate answer.

Trace one end-to-end journey through browser/client → deployed API/runtime → PostgreSQL/Supabase → response. Verify that both features use compatible identity, record/status rules and environment configuration. Exercise one success and one controlled failure; inspect the available logs. If a cache was added as a Day 6 experiment, confirm it cannot show stale price/stock data or bypass the database's authority.

For live availability or order progress, compare polling, Server-Sent Events (SSE), and WebSockets at a high level. Identify what message is sent, how clients reconnect, and how the server derives updates from persisted state. Treat countdowns and live counts as display hints; the database remains authoritative, and a timer in a browser does not release a reservation by itself.

Confirm any scheduled expiry/notification worker has an actual execution mechanism in the integrated deployment, and document its owner and trigger. If no worker or queue is configured, mark that behavior as pending instead of treating the timer shown in the UI as proof it runs.