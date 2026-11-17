import { readFile } from 'node:fs/promises'
import pg from 'pg'

let client
try {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing; run npm run check from this folder')
  const connection = new URL(process.env.DATABASE_URL)
  if (connection.hostname !== 'aws-0-ap-southeast-1.pooler.supabase.com') throw new Error('Unexpected database host in the handoff configuration')
  // pg URL TLS options replace an explicit SSL object. Use the verified CA below.
  for (const option of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) connection.searchParams.delete(option)
  const ca = await readFile(new URL('./certs/prod-ca-2021.crt', import.meta.url), 'utf8')
  client = new pg.Client({
    connectionString: connection.toString(),
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
    application_name: 'temuevent-backend-handoff-check',
    ssl: { ca, rejectUnauthorized: true, servername: connection.hostname },
  })
  await client.connect()
  const result = await client.query('SELECT role, count(*)::integer AS count FROM temuevent.users GROUP BY role ORDER BY role')
  console.log('DATABASE CONNECTION OK; TLS certificate and hostname verification enabled.')
  console.table(result.rows)
  console.log('Read-only check completed. No tables or data were changed.')
} catch (error) {
  // Do not log the URL, password, client object or full connection configuration.
  console.error(`Database check failed (${error.code || 'CONFIGURATION_OR_CONNECTION'}).`)
  console.error('Check Node version, the .env file, the bundled CA and network connectivity; see README.md.')
  process.exitCode = 1
} finally {
  if (client) await client.end().catch(() => {})
}
