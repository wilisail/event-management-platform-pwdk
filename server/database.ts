import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { rootCertificates } from 'node:tls'
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
  const certificatePath = process.env.DATABASE_CA_CERT_PATH || resolve('database/certs/prod-ca-2021.crt')
  const connection = new URL(connectionString)
  for (const key of ['ssl', 'sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat']) connection.searchParams.delete(key)
  const adapter = new PrismaPg({
    connectionString: connection.toString(),
    max: 3,
    connectionTimeoutMillis: 8000,
    ssl: { ca: [...rootCertificates, readFileSync(/* turbopackIgnore: true */ certificatePath, 'utf8')], rejectUnauthorized: true },
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

export interface EventReviewView {
  id: string
  eventId: string
  userId: string
  reviewerName: string
  rating: number
  comment: string | null
  createdAt: string
}

export interface CreateEventReviewInput {
  eventId: string
  userId: string
  rating: number
  comment?: string
}

export interface CreateEventInput {
  name: string
  category: string
  location: string
  venue?: string
  address?: string
  description: string
  imageUrl?: string
  imagePublicId?: string
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
export async function createEvent(input: CreateEventInput) {
  return createEventWriter(databaseClient())(input)
}

export function createEventWriter(client: Pick<PrismaClient, 'event'>) {
  return async (input: CreateEventInput) => {
  const baseSlug = input.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const slug = `${baseSlug}-${randomUUID().slice(0, 8)}`

  const event = await client.event.create({
      data: {
          name: input.name,
          slug,
          category: input.category,
          location: input.location,
          venue: input.venue,
          address: input.address,
          description: input.description,
          imageUrl: input.imageUrl,
          imagePublicId: input.imagePublicId,
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
}

export async function imagePublicIdInUse(publicId: string) {
  return Boolean(await databaseClient().event.findFirst({ where: { imagePublicId: publicId }, select: { id: true } }))
}

/** Public organizer profile, including published events and their reviews. */
export async function readOrganizerProfile(organizerId: string) {
  const organizer = await databaseClient().user.findFirst({
    where: {
      id: organizerId,
      role: 'ORGANIZER',
    },
    select: {
      id: true,
      name: true,
      profilePictureKey: true,
      events: {
        where: {
          status: 'PUBLISHED',
        },
        orderBy: {
          startAt: 'asc',
        },
        select: {
          id: true,
          name: true,
          category: true,
          location: true,
          venue: true,
          startAt: true,
          endAt: true,
          imageUrl: true,
          ticketTypes: {
            select: {
              availableSeats: true,
              price: true,
            },
          },
          reviews: {
            orderBy: {
              createdAt: 'desc',
            },
            select: {
              id: true,
              rating: true,
              comment: true,
              createdAt: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!organizer) return null;

  const events = organizer.events.map((event) => ({
    id: event.id,
    name: event.name,
    category: event.category,
    location: event.location,
    venue: event.venue,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt.toISOString(),
    image: event.imageUrl,
    availableSeats: event.ticketTypes.reduce(
      (total, ticket) => total + ticket.availableSeats,
      0,
    ),
    minimumPrice: event.ticketTypes.length
      ? Math.min(...event.ticketTypes.map((ticket) => Number(ticket.price)))
      : null,
  }));

  const reviews = organizer.events.flatMap((event) =>
    event.reviews.map((review) => ({
      id: review.id,
      eventId: event.id,
      eventName: event.name,
      reviewerName: review.user.name,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt.toISOString(),
    })),
  );

  return {
    organizer: {
      id: organizer.id,
      name: organizer.name,
      profilePicture: organizer.profilePictureKey ? `/api/organizers/${organizer.id}/picture` : null,
    },
    events,
    reviews,
  };
}

/** Public reviews for a published event. */
export async function readEventReviews(
  eventId: string,
): Promise<EventReviewView[] | null> {
  const event = await databaseClient().event.findFirst({
    where: {
      id: eventId,
      status: 'PUBLISHED',
    },
    select: {
      id: true,
      reviews: {
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          eventId: true,
          userId: true,
          rating: true,
          comment: true,
          createdAt: true,
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  })

  if (!event) return null

  return event.reviews.map((review) => ({
    id: review.id,
    eventId: review.eventId,
    userId: review.userId,
    reviewerName: review.user.name,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
  }))
}

/** Create a review for a published event with a completed purchase. */
export async function createEventReview(
  input: CreateEventReviewInput,
): Promise<EventReviewView> {
  const db = databaseClient()

  // 1. Check whether the event exists and is published.
  const event = await db.event.findFirst({
    where: {
      id: input.eventId,
      status: 'PUBLISHED',
    },
    select: {
      id: true,
    },
  })

  if (!event) {
    throw new Error('EVENT_NOT_FOUND')
  }

  // 2. Check whether this customer has completed a purchase.
  const purchase = await db.purchase.findFirst({
    where: {
      eventId: input.eventId,
      customerId: input.userId,
      status: 'DONE',
    },
    select: {
      id: true,
    },
  })

  if (!purchase) {
    throw new Error('PURCHASE_REQUIRED')
  }

  // 3. Create the review.
  const review = await db.review.create({
    data: {
      eventId: input.eventId,
      userId: input.userId,
      rating: input.rating,
      comment: input.comment?.trim() || null,
    },
    select: {
      id: true,
      eventId: true,
      userId: true,
      rating: true,
      comment: true,
      createdAt: true,
      user: {
        select: {
          name: true,
        },
      },
    },
  })

  return {
    id: review.id,
    eventId: review.eventId,
    userId: review.userId,
    reviewerName: review.user.name,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
  }
}

export async function disconnectDatabase() {
  await client?.$disconnect()
  client = undefined
}
