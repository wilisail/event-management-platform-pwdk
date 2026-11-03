import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

export const seededUserEmail = 'ayu@example.test'

export interface DatabaseUserView {
  id: string
  email: string
  name: string
  role: 'CUSTOMER' | 'ORGANIZER'
  referralCode: string
}

let client: PrismaClient | undefined

export function databaseClient() {
  if (client) return client
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is required for database commands')
  const certificatePath = process.env.DATABASE_CA_CERT_PATH
  const adapter = new PrismaPg({
    connectionString,
    max: 3,
    connectionTimeoutMillis: 8000,
    ...(certificatePath
      ? { ssl: { ca: readFileSync(certificatePath, 'utf8'), rejectUnauthorized: true } }
      : {}),
  })
  client = new PrismaClient({ adapter })
  return client
}

export function readSeededDatabaseUser(): Promise<DatabaseUserView | null> {
  return databaseClient().user.findUnique({
    where: { email: seededUserEmail },
    select: { id: true, email: true, name: true, role: true, referralCode: true },
  })
}

export interface PublicEventView {
  id: string
  title: string
  category: string
  date: string
  location: string
  price: number | null
  image: string | null
  organizer: string
  availableSeats: number
}

export interface CreateEventInput {
  name: string
  category: string
  location: string
  venue?: string
  address?: string
  description: string
  startAt: Date
  endAt: Date
  status: 'DRAFT' | 'PUBLISHED'
  organizerId: string
  ticketTypes: {
    name: string
    description: string
    price: number
    quota: number
  }[]
}

/** Public, read-only event listing for the Feature 1 homepage. */
export async function readPublishedEvents(): Promise<PublicEventView[]> {
  const events = await databaseClient().event.findMany({
    where: {
      status: 'PUBLISHED',
      startAt: { gte: new Date() },
    },
    include: {
      organizer: { select: { name: true } },
      ticketTypes: { select: { price: true, availableSeats: true } },
    },
    orderBy: { startAt: 'asc' },
  })

  return events.map((event) => {
    const prices = event.ticketTypes.map((ticket) => Number(ticket.price))
    const availableSeats = event.ticketTypes.reduce(
      (total, ticket) => total + ticket.availableSeats,
      0,
    )

    return {
      id: event.id,
      title: event.name,
      category: event.category,
      date: event.startAt.toISOString(),
      location: event.location, 
        // event.venue,
        // ? `${event.venue}, ${event.location}`
        // : event.location,
      price: prices.length ? Math.min(...prices) : null,
      image: event.imageUrl,
      organizer: event.organizer.name,
      availableSeats,
    }
  })
}

/** Public, read-only event detail for the Feature 1 event page. */
export async function readPublishedEventById(eventId: string) {
  const event = await databaseClient().event.findFirst({
    where: {
      id: eventId,
      status: 'PUBLISHED',
    },
    include: {
      organizer: {
        select: {
          id: true,
          name: true,
        },
      },
      ticketTypes: {
        select: {
          price: true,
          availableSeats: true,
        },
      },
    },
  })

  if (!event) return null

  const prices = event.ticketTypes.map((ticket) => Number(ticket.price))

  const availableSeats = event.ticketTypes.reduce(
    (total, ticket) => total + ticket.availableSeats,
    0,
  )

  return {
    id: event.id,
    title: event.name,
    category: event.category,
    date: event.startAt.toISOString(),
    endDate: event.endAt.toISOString(),
    location: event.location,
    venue: event.venue,
    address: event.address,
    description: event.description,
    image: event.imageUrl,
    price: prices.length ? Math.min(...prices) : null,
    availableSeats,
    organizerId: event.organizer.id,
    organizer: event.organizer.name,
  }
}

/** Create an event and its ticket types for Feature 1. */
/** Create an event and its ticket types for Feature 1. */
export async function createEvent(input: CreateEventInput) {
  const baseSlug = input.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const slug = `${baseSlug}-${randomUUID().slice(0, 8)}`

  const event = await databaseClient().event.create({
      data: {
          name: input.name,
          slug,
          category: input.category,
          location: input.location,
          venue: input.venue,
          address: input.address,
          description: input.description,
          startAt: input.startAt,
          endAt: input.endAt,
          status: input.status,
          organizerId: input.organizerId,

          ticketTypes: {
              create: input.ticketTypes.map((ticket) => ({
                  name: ticket.name,
                  description: ticket.description,
                  price: BigInt(ticket.price),
                  quota: ticket.quota,
                  availableSeats: ticket.quota,
              })),
          },
      },
      include: {
          ticketTypes: true,
      },
  });

  // Convert BigInt prices to numbers before returning JSON-compatible data.
  return {
    id: event.id,
    name: event.name,
    slug: event.slug,
    category: event.category,
    location: event.location,
    venue: event.venue,
    address: event.address,
    description: event.description,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt.toISOString(),
    status: event.status,
    ticketTypes: event.ticketTypes.map((ticket) => ({
      id: ticket.id,
      name: ticket.name,
      description: ticket.description,
      price: Number(ticket.price),
      quota: ticket.quota,
      availableSeats: ticket.availableSeats,
    })),
  }
}

export async function disconnectDatabase() {
  await client?.$disconnect()
  client = undefined
}
