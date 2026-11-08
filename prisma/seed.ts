
import { databaseClient, disconnectDatabase } from '../server/database'

async function seed() {
  const db = databaseClient()

  await db.$transaction(
  async (tx) => {
    // 1. Create or reuse development identities.
    const customer = await tx.user.upsert({
      where: { email: 'ayu@example.test' },
      create: {
        email: 'ayu@example.test',
        name: 'Ayu Pratiwi',
        role: 'CUSTOMER',
        referralCode: 'AYU7K2P',
      },
      update: {},
    })

    const organizer = await tx.user.upsert({
      where: { email: 'organizer@example.test' },
      create: {
        id: '073ae087-205f-4f45-8b96-c7e4fb3efae4',
        email: 'organizer@example.test',
        name: 'Jakarta Coffee Collective',
        role: 'ORGANIZER',
        referralCode: 'JCCDEMO',
      },
      update: {},
    })

    // 2. Create or reuse a dedicated published test event.
    const startAt = new Date()
    startAt.setDate(startAt.getDate() + 30)
    startAt.setHours(10, 0, 0, 0)

    const endAt = new Date(startAt)
    endAt.setHours(endAt.getHours() + 3)

    const event = await tx.event.upsert({
      where: { slug: 'review-test-event' },
      create: {
        organizerId: organizer.id,
        slug: 'review-test-event',
        name: 'TemuEvent Review Testing',
        category: 'Workshop',
        location: 'Jakarta',
        venue: 'TemuEvent Test Venue',
        address: 'Jakarta, Indonesia',
        description: 'Dedicated event for testing the review feature.',
        startAt,
        endAt,
        status: 'PUBLISHED',
      },
      update: {
        organizerId: organizer.id,
        startAt,
        endAt,
        status: 'PUBLISHED',
      },
    })

    // 3. Create or reuse a ticket type.
    const ticket = await tx.ticketType.upsert({
      where: {
        eventId_name: {
          eventId: event.id,
          name: 'General Admission',
        },
      },
      create: {
        eventId: event.id,
        name: 'General Admission',
        description: 'Test ticket for review eligibility.',
        price: BigInt(150000),
        quota: 50,
        availableSeats: 49,
      },
      update: {
        price: BigInt(150000),
        quota: 50,
        availableSeats: 49,
      },
    })

    // 4. Create or reuse a completed purchase for Ayu.
    const purchase = await tx.purchase.upsert({
      where: { reference: 'F1-REVIEW-TEST-AYU-001' },
      create: {
        reference: 'F1-REVIEW-TEST-AYU-001',
        customerId: customer.id,
        eventId: event.id,
        status: 'DONE',
        subtotal: BigInt(150000),
        totalPrice: BigInt(150000),
        completedAt: new Date(),
      },
      update: {
        customerId: customer.id,
        eventId: event.id,
        status: 'DONE',
        subtotal: BigInt(150000),
        totalPrice: BigInt(150000),
        completedAt: new Date(),
      },
    })

    // 5. Create or reuse the purchase item.
    await tx.purchaseItem.upsert({
      where: {
        purchaseId_ticketTypeId: {
          purchaseId: purchase.id,
          ticketTypeId: ticket.id,
        },
      },
      create: {
        eventId: event.id,
        purchaseId: purchase.id,
        ticketTypeId: ticket.id,
        quantity: 1,
        unitPrice: BigInt(150000),
        lineTotal: BigInt(150000),
      },
      update: {
        eventId: event.id,
        quantity: 1,
        unitPrice: BigInt(150000),
        lineTotal: BigInt(150000),
      },
    })

    console.log('Development test data ready:')
    console.log(`Customer: ${customer.email} (${customer.id})`)
    console.log(`Organizer: ${organizer.name} (${organizer.id})`)
    console.log(`Event: ${event.name} (${event.id})`)
    console.log(`Purchase: ${purchase.reference} — ${purchase.status}`)
    },
  {
    maxWait: 20000,
    timeout: 60000,
  },
)
}

seed()
  .catch((error) => {
    console.error('Database seed failed:', error)
    process.exitCode = 1
  })
  .finally(disconnectDatabase)
