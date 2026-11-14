import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PrismaClient } from '../generated/prisma/client'
import { readPublishedEventById } from '../server/database'

test('published ticket choices retain the existing review and Organizer details', async () => {
  const id = '11111111-1111-4111-8111-111111111111'
  const db = { event: { findFirst: async (query: { where: unknown }) => {
    assert.deepEqual(query.where, { id, status: 'PUBLISHED' })
    return {
      id, name: 'Shared event', category: 'Learning', location: 'Jakarta', venue: null,
      address: null, description: 'Ticket detail regression', imageUrl: null,
      startAt: new Date('2027-01-01T03:00:00Z'), endAt: new Date('2027-01-01T05:00:00Z'),
      organizer: { id: 'owner', name: 'Event owner', profilePictureKey: 'private-picture' },
      reviews: [{ rating: 4 }, { rating: 5 }],
      ticketTypes: [
        { id: 'regular', name: 'Regular', description: 'Entry', price: '75000', quota: 10, availableSeats: 2 },
        { id: 'workshop', name: 'Workshop', description: 'Entry and workshop', price: '125000', quota: 4, availableSeats: 1 },
      ],
    }
  } } } as unknown as PrismaClient
  const event = await readPublishedEventById(id, db)
  assert(event)
  assert.equal(event.availableSeats, 3)
  assert.equal(event.price, 75000)
  assert.equal(event.rating, 4.5)
  assert.equal(event.reviewCount, 2)
  assert.equal(event.organizerPicture, '/api/organizers/owner/picture')
  assert.equal(event.ticketTypes[0].price, 75000)
  assert.equal(event.ticketTypes[0].availableSeats, 2)
  assert.equal(event.ticketTypes[1].name, 'Workshop')
  assert.equal(event.ticketTypes[1].quota, 4)
  const missing = { event: { findFirst: async () => null } } as unknown as PrismaClient
  assert.equal(await readPublishedEventById(id, missing), null)
})
