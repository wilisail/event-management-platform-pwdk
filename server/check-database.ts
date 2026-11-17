import { disconnectDatabase, readSeededDatabaseUser } from './database'

async function check() {
  const user = await readSeededDatabaseUser()
  if (!user) throw new Error('Seeded user missing')
  console.log(JSON.stringify({ success: true, database: 'PostgreSQL', seededUser: user }, null, 2))
}

check()
  .catch(() => { console.error('Database check failed. Check the backend connection settings, TLS certificate and network.'); process.exitCode = 1 })
  .finally(disconnectDatabase)
