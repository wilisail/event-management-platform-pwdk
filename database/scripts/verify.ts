import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { databaseClient, disconnectDatabase } from '../src/client'
const db = databaseClient()
const rollback = new Error('ROLLBACK_READINESS_CHECK')
const makeEvent = (organizerId: string) => ({
  organizerId, slug: 'readiness-' + randomUUID(), name: 'Rollback-only readiness event',
  category: 'Test', location: 'Test', startAt: new Date(Date.now()+86400000),
  endAt: new Date(Date.now()+90000000),
})
async function main() {
  const organizer = await db.user.findUniqueOrThrow({ where: { email: 'organizer@example.test' } })
  const customer = await db.user.findUniqueOrThrow({ where: { email: 'ayu@example.test' } })
  const before = await db.event.count()
  await assert.rejects(db.$transaction(async tx => {
    const event = await tx.event.create({ data: makeEvent(organizer.id) })
    const ticket = await tx.ticketType.create({ data: {
      eventId: event.id, name: 'Regular', price: 150000n, quota: 2, availableSeats: 2,
    } })
    const purchase = await tx.purchase.create({ data: {
      reference: 'CHECK-' + randomUUID(), customerId: customer.id, eventId: event.id,
      subtotal: 150000n, totalPrice: 150000n, paymentDueAt: new Date(Date.now()+7200000),
    } })
    await tx.purchaseItem.create({ data: {
      eventId: event.id, purchaseId: purchase.id, ticketTypeId: ticket.id,
      quantity: 1, unitPrice: 150000n, lineTotal: 150000n,
    } })
    const changed = await tx.ticketType.updateMany({
      where: { id: ticket.id, availableSeats: { gte: 1 } },
      data: { availableSeats: { decrement: 1 } },
    })
    assert.equal(changed.count, 1)
    const joined = await tx.purchase.findUniqueOrThrow({
      where: { id: purchase.id }, include: { items: { include: { ticketType: true } }, event: true },
    })
    assert.equal(joined.items[0].ticketType.name, 'Regular')
    assert.equal(joined.items[0].unitPrice, 150000n)
    throw rollback
  }), error => error === rollback)
  assert.equal(await db.event.count(), before, 'Rollback left no event behind')

  let crossEventAttempted = false
  await assert.rejects(db.$transaction(async tx => {
    const first = await tx.event.create({ data: makeEvent(organizer.id) })
    const second = await tx.event.create({ data: makeEvent(organizer.id) })
    const ticket = await tx.ticketType.create({ data: {
      eventId: second.id, name: 'Other event', price: 100n, quota: 1, availableSeats: 1,
    } })
    const purchase = await tx.purchase.create({ data: {
      reference: 'CHECK-' + randomUUID(), customerId: customer.id, eventId: first.id,
      subtotal: 100n, totalPrice: 100n, paymentDueAt: new Date(Date.now()+7200000),
    } })
    crossEventAttempted = true
    await tx.purchaseItem.create({ data: {
      eventId: first.id, purchaseId: purchase.id, ticketTypeId: ticket.id,
      quantity: 1, unitPrice: 100n, lineTotal: 100n,
    } })
  }), (error: any) => error.code === 'P2003')
  assert(crossEventAttempted, 'Cross-event assertion reached the foreign key')
  assert.equal(await db.event.count(), before, 'Failed purchase rolled back related events')
  const demoCount = await db.purchase.count({ where: { reference: { startsWith: 'DEMO-20261028-' } } })
  assert.equal(demoCount, 30)
  const statuses = await db.purchase.groupBy({ by: ['status'],
    where: { reference: { startsWith: 'DEMO-20261028-' } }, _count: { _all: true } })
  assert.equal(statuses.length, 6)
  assert(statuses.every(x => x._count._all === 5))
  console.log(JSON.stringify({ passed: [
    'Prisma read/write with existing backend credentials',
    'User -> event -> ticket -> purchase -> item joins',
    'Conditional seat update inside the purchase transaction',
    'Intentional rollback leaves no test rows',
    'Cross-event ticket rejected by composite foreign key',
    'Thirty demo purchases, five per required status',
  ] }, null, 2))
}
main().catch(() => {
  console.error('Database readiness verification failed')
  process.exitCode = 1
}).finally(disconnectDatabase)
