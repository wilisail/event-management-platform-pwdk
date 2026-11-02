import { databaseClient, disconnectDatabase } from '../src/client'
const prisma = databaseClient()
async function main() {
try {
  const [events, tickets, purchases, statuses] = await Promise.all([
    prisma.event.count(),
    prisma.ticketType.count(),
    prisma.purchase.count(),
    prisma.purchase.groupBy({ by: ['status'], _count: { _all: true } }),
  ])
  const example = await prisma.event.findFirst({
    where: { slug: 'jakarta-coffee-festival-demo' },
    select: { id: true, name: true, organizer: { select: { name: true } },
      ticketTypes: { select: { name: true, price: true, quota: true, availableSeats: true } } },
  })
  console.log(JSON.stringify({ events, tickets, purchases, statuses, example },
    (_key, value) => typeof value === 'bigint' ? Number(value) : value, 2))
} catch (error) {
  console.error('Database check failed. Verify the backend credentials and TLS certificate setup.')
  process.exitCode = 1
} finally {
  await disconnectDatabase()
}

}
main()
