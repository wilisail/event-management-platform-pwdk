# Feature 1: Homepage events API

The homepage reads published upcoming events from PostgreSQL through the Express API.

## Flow

`app/page.tsx` → `GET /api/events` → `server/app.ts` → `server/database.ts` → Prisma → PostgreSQL (`temuevent.events` and `temuevent.ticket_types`).

## Files

- `server/database.ts`: Prisma query and mapping from database models to the public homepage event shape.
- `server/app.ts`: Express `GET /api/events` route and JSON response.
- `server/index.ts`: starts the API and injects the database reader.
- `app/page.tsx`: fetches the endpoint and keeps the existing search/category/location filtering and cards.
- `.env.example`: local API/database configuration template.

## Local setup

1. Copy `.env.example` to `.env`.
2. Replace the placeholder `DATABASE_URL` with the application connection string supplied to your team. Do not commit `.env`.
3. Keep `DATABASE_CA_CERT_PATH` pointing to the supplied CA certificate.
4. Install the root dependencies if they are not installed: `npm install`.
5. Generate the Prisma client: `npm run db:generate`.
6. Start both apps: `npm run dev`.
7. Open `http://127.0.0.1:3001` and check the API directly at `http://127.0.0.1:4002/api/events`.

The API returns only events with `PUBLISHED` status and a start time in the future. Price is the lowest ticket-type price; available seats are summed across ticket types. Free events have a ticket type priced at zero.

If the API returns an empty `data` array, check whether the database has future published events and associated ticket types. If it returns `EVENTS_UNAVAILABLE`, check the server terminal for the database error and verify the `.env` connection settings.
