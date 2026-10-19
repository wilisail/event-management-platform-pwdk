# Shared database connection check

This folder provides an independent connection check for feature 1 and feature 2. It reads the existing customer/organizer records from the shared database. Neither feature needs to be finished to run it.

## Run

Use Node.js 22.12 or newer. Take this folder from `main` in a separate checkout or temporary folder; each feature keeps its own application code and branch.

1. Create `.env` in this folder using the application connection settings supplied by Wili. The private handoff ZIP already contains this file. Alternatively copy `.env.example` and replace its password placeholder. The actual password is deliberately absent from GitHub.
2. From this folder, run:

   ```sh
   npm ci
   npm run check
   ```

The expected result is `DATABASE CONNECTION OK`, followed by one `CUSTOMER` and one `ORGANIZER`. The checker performs a SELECT query; it does not create tables or change data. It installs only the PostgreSQL driver and its dependencies.

The official Supabase CA is included in `certs/prod-ca-2021.crt`. Certificate and hostname verification stay enabled. If the CA file is missing, `npm run setup:ca` downloads it from the official source and checks its fingerprint.

## Connect a feature's own backend

- Add `DATABASE_URL` to the feature's ignored backend `.env`, preserving other environment settings.
- Load that variable before constructing the database client. For the existing Prisma/pg pattern, keep `sslmode=verify-full` and set `NODE_EXTRA_CA_CERTS` to the absolute CA path before Node starts. The [database setup note](../database-setup.md#connect-from-a-development-machine-or-cloud-vm) explains this configuration.
- `check-db.mjs` also shows an explicit `pg` SSL configuration. Its URL SSL options are removed so they cannot override the explicitly supplied CA. A feature may use its own compatible backend configuration.
- The existing customer and organizer IDs are UUIDs in `temuevent.users`. Their seed emails are `ayu@example.test` and `organizer@example.test`; real application login is still feature 2 work.

The application login currently has access to the existing users table. It is separate from the migration/admin connection. New event, ticket and transaction tables require their agreed migrations, application-role grants and RLS policies. Keep one ordered migration history; do not replay the initial baseline. Feature 1 retains its own table/query/business-rule implementation.

## Verification

On 19 October 2026, these scripts ran in a temporary Node.js 24 cloud VM: `npm ci` installed 14 locked packages; the official CA fingerprint matched; the authenticated, certificate-verified database read returned one customer and one organizer. No data or schema writes were performed. The temporary VM was stopped afterwards.

The check proves connectivity to the existing users table. Event/purchase persistence, working application login and the planned sample transactions remain separate feature work.

## Troubleshooting

| Error | Check |
| --- | --- |
| `ENOTFOUND` / `EAI_AGAIN` | DNS resolution in the environment running the backend |
| `ETIMEDOUT` / `ECONNREFUSED` | Network access to the configured pooler and port |
| `28P01` | The supplied application login/password in `.env` |
| Certificate error | The supplied CA and the backend's TLS configuration |
| Missing relation or permission | Migration state, schema and application-role grants |

Share the error code and command when debugging. Keep `.env`, full connection strings containing passwords and the private ZIP outside public commits, issues and logs. Supabase dashboard membership does not supply this application password.

See [database setup](../database-setup.md) and [technical reference](../technical-reference.md) for the shared system record.
