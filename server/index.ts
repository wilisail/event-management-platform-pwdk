import 'dotenv/config'
import { createApp } from './app'

const port = Number(process.env.F2_API_PORT || 4002)
const host = process.env.F2_API_HOST || '127.0.0.1'
const allowedOrigins = (
  process.env.F2_ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001,http://127.0.0.1:3001'
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid F2_API_PORT')

async function start() {
  // Load the database module for Feature 1's public event listing. The Prisma
  // client connects lazily when the first database query is made.
  const database = await import('./database')
  const databaseProbe = process.env.F2_DATABASE_CHECK_ENABLED === 'true' && process.env.NODE_ENV !== 'production'
    ? database.readSeededDatabaseUser
    : undefined
  const server = createApp({
    allowedOrigins,
    databaseProbe,
    eventsReader: database.readPublishedEvents,
  })
    .listen(port, host, () => {
      console.log(`TemuEvent API: http://${host}:${port}`)
      console.log('GET /api/events reads published upcoming events from PostgreSQL.')
    })
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      server.close(() => {
        void database?.disconnectDatabase().finally(() => process.exit(0))
        if (!database) process.exit(0)
      })
    })
  }
}

start().catch(() => {
  console.error('Unable to start the demo API. Check the backend configuration.')
  process.exitCode = 1
})
