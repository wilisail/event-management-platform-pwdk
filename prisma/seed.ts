import { databaseClient, disconnectDatabase } from '../server/database'

async function seed() {
  const db = databaseClient()
  const users = [
    { email: 'ayu@example.test', name: 'Ayu Pratiwi', role: 'CUSTOMER' as const, referralCode: 'AYU7K2P' },
    { id: '073ae087-205f-4f45-8b96-c7e4fb3efae4', email: 'organizer@example.test', name: 'Jakarta Coffee Collective', role: 'ORGANIZER' as const, referralCode: 'JCCDEMO' },
  ]
  await db.$transaction(async (tx) => {
    for (const user of users) {
      await tx.user.upsert({ where: { email: user.email }, create: user, update: {} })
    }
  })
  console.log('Development identities ready: 1 customer and 1 organizer. Login is not implemented.')
}

seed()
  .catch(() => { console.error('Database seed failed. Check the backend connection settings and network.'); process.exitCode = 1 })
  .finally(disconnectDatabase)
