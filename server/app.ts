import { unlink } from 'node:fs/promises'
import { upload } from './upload'
import { uploadImage } from './cloudinary'
import express, { type ErrorRequestHandler, type Request, type Response } from 'express'
import { z } from 'zod'
import type { ApiSuccess, DemoPersona, UserView } from '../contracts/types'
import { walletFor } from '../domain/rewards'
import { createDemoData, type DemoData } from './fixtures'
import type {
  CreateEventInput,
  CreateEventReviewInput,
  DatabaseUserView,
  PublicEventView,
  createEventReview,
  readPublishedEventById,
  readOrganizerProfile,
  readEventReviews,
} from './database'

const createEventSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1),
  location: z.string().trim().min(1),
  venue: z.string().trim().optional(),
  address: z.string().trim().optional(),
  description: z.string().trim().min(1),
  imageUrl: z.string().url().optional(),
  imagePublicId: z.string().trim().min(1).optional(),
  startAt: z.string().refine(
    (value) => !Number.isNaN(Date.parse(value)),
    'Invalid start date',
  ),
  endAt: z.string().refine(
    (value) => !Number.isNaN(Date.parse(value)),
    'Invalid end date',
  ),
  status: z.enum(['DRAFT', 'PUBLISHED']),
  organizerId: z.string().uuid(),
  ticketTypes: z.array(
    z.object({
      name: z.string().trim().min(1),
      description: z.string(),
      price: z.number().int().nonnegative().safe(),
      quota: z.number().int().positive(),
    }),
  ).min(1),
}).refine(
  (event) => new Date(event.endAt) > new Date(event.startAt),
  {
    message: 'End date must be after start date',
    path: ['endAt'],
  },
)

const createEventReviewSchema = z.object({
  userId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
})

export interface AppOptions {
  now?: () => Date
  data?: DemoData
  allowedOrigins?: string[]
  databaseProbe?: () => Promise<DatabaseUserView | null>
  eventsReader?: () => Promise<PublicEventView[]>
  eventReader?: (eventId: string) => Promise<
    Awaited<ReturnType<typeof readPublishedEventById>>
  >
  eventCreator?: (input: CreateEventInput) => Promise<unknown>
  organizerReader?: (organizerId: string) => Promise<
    Awaited<ReturnType<typeof readOrganizerProfile>>
  >
  reviewReader?: (eventId: string) => Promise<
    Awaited<ReturnType<typeof readEventReviews>>
  >
  reviewCreator?: (input: CreateEventReviewInput) => Promise<
    Awaited<ReturnType<typeof createEventReview>>
  >
  imageUploader?: (file: { path: string }) => Promise<{
  secure_url: string
  public_id: string
}>
}

export function createApp(options: AppOptions = {}) {
  const now = options.now ?? (() => new Date())
  const data = options.data ?? createDemoData(now())
  const allowedOrigins = options.allowedOrigins ?? [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
  ]
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json())

  const fail = (res: Response, status: number, code: string, message: string) => {
    res.status(status).json({ success: false, code, message })
  }
  const ok = <T>(res: Response, value: T, message: string) => {
    const body: ApiSuccess<T> = {
      success: true,
      message,
      data: value,
      meta: { mode: 'demo', contractVersion: '0.1-proposal', asOf: now().toISOString() },
    }
    res.json(body)
  }

  app.use((req, res, next) => {
    const origin = req.get('origin')
    if (origin && !allowedOrigins.includes(origin)) {
      fail(res, 403, 'ORIGIN_NOT_ALLOWED', 'Origin is not allowed for this local demo')
      return
    }
    if (origin) {
      res.set('Access-Control-Allow-Origin', origin)
      res.vary('Origin')
      res.set('Access-Control-Allow-Headers', 'content-type,x-demo-persona')
      res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(204)
      return
    }
    next()
  })

  /** Demo selection only. This header MUST NOT be used as production authentication. */
  const demoUser = (req: Request, res: Response): UserView | null => {
    const parsed = z.enum(['customer', 'organizer']).safeParse(req.get('x-demo-persona'))
    if (!parsed.success) {
      fail(res, 401, 'DEMO_PERSONA_REQUIRED', 'Select customer or organizer using x-demo-persona')
      return null
    }
    const persona: DemoPersona = parsed.data
    return persona === 'customer' ? data.customer : data.organizerUser
  }

  app.post(
    '/api/uploads/event-image',
    upload.single('image'),
    async (req, res) => {
      const file = req.file

      if (!file) {
        fail(res, 400, 'IMAGE_REQUIRED', 'Please select an image to upload')
        return
      }

      try {
        const uploader = options.imageUploader ?? uploadImage
        const result = await uploader({ path: file.path })

        res.status(201).json({
          success: true,
          message: 'Event image uploaded successfully',
          data: {
            imageUrl: result.secure_url,
            imagePublicId: result.public_id,
          },
          meta: {
            mode: 'database',
            contractVersion: '1.0',
            asOf: now().toISOString(),
          },
        })
      } catch (error) {
        console.error('POST /api/uploads/event-image failed:', error)
        fail(res, 500, 'IMAGE_UPLOAD_FAILED', 'Unable to upload event image')
      } finally {
        await unlink(file.path).catch((error) => {
          console.error('Unable to remove temporary image:', error)
        })
      }
    },
  )

  app.get('/health', (_req, res) =>
    ok(res, { service: 'feature-2-demo', readOnly: true }, 'Demo API ready'),
  )

  app.get('/api/events', async (_req, res) => {
    if (!options.eventsReader) {
      fail(res, 503, 'DATABASE_NOT_CONFIGURED', 'Event database reader is not configured')
      return
    }
    try {
      const events = await options.eventsReader()
      res.json({
        success: true,
        message: 'Published upcoming events',
        data: events,
        meta: { mode: 'database', contractVersion: '1.0', asOf: now().toISOString() },
      })
    } catch (error) {
      console.error('GET /api/events failed:', error)
      fail(res, 503, 'EVENTS_UNAVAILABLE', 'Unable to retrieve events from the database')
    }
  })
  app.post('/api/events', async (req, res) => {
  if (!options.eventCreator) {
    fail(res, 503, 'DATABASE_NOT_CONFIGURED', 'Event database writer is not configured')
    return
  }

  const parsed = createEventSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      code: 'INVALID_EVENT_DATA',
      message: 'Please check the event details',
      errors: parsed.error.flatten(),
    })
    return
  }

  try {
    const input: CreateEventInput = {
      ...parsed.data,
      startAt: new Date(parsed.data.startAt),
      endAt: new Date(parsed.data.endAt),
    }

    const event = await options.eventCreator(input)

    // Convert any BigInt values into JSON-compatible numbers.
    const safeEvent = JSON.parse(
      JSON.stringify(event, (_key, value) =>
        typeof value === 'bigint' ? Number(value) : value,
      ),
    )

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: safeEvent,
      meta: {
        mode: 'database',
        contractVersion: '1.0',
        asOf: now().toISOString(),
      },
    })
  } catch (error) {
    console.error('POST /api/events failed:', error)

      if (error instanceof Error) {
        console.error('Error name:', error.name)
        console.error('Error message:', error.message)
        console.error('Error stack:', error.stack)
      }
    fail(res, 500, 'EVENT_CREATION_FAILED', 'Unable to create event')
  }
})
  app.get('/api/events/:eventId', async (req, res) => {
    if (!options.eventReader) {
      fail(res, 503, 'DATABASE_NOT_CONFIGURED', 'Event database reader is not configured')
      return
    }

    try {
      const event = await options.eventReader(req.params.eventId)

      if (!event) {
        fail(res, 404, 'EVENT_NOT_FOUND', 'Event not found')
        return
      }

      res.json({
        success: true,
        message: 'Event details',
        data: event,
        meta: {
          mode: 'database',
          contractVersion: '1.0',
          asOf: now().toISOString(),
        },
      })
    } catch (error) {
      console.error(`GET /api/events/${req.params.eventId} failed:`, error)
      fail(res, 503, 'EVENTS_UNAVAILABLE', 'Unable to retrieve event from the database')
    }
  })
    app.get('/api/organizers/:organizerId', async (req, res) => {
    if (!options.organizerReader) {
      fail(
        res,
        503,
        'DATABASE_NOT_CONFIGURED',
        'Organizer database reader is not configured',
      )
      return
    }

    const organizerId = z.string().uuid().safeParse(req.params.organizerId)

    if (!organizerId.success) {
      fail(res, 400, 'INVALID_ORGANIZER_ID', 'Organizer ID must be a valid UUID')
      return
    }

    try {
      const organizer = await options.organizerReader(organizerId.data)

      if (!organizer) {
        fail(res, 404, 'ORGANIZER_NOT_FOUND', 'Organizer not found')
        return
      }

      res.json({
        success: true,
        message: 'Organizer profile',
        data: organizer,
        meta: {
          mode: 'database',
          contractVersion: '1.0',
          asOf: now().toISOString(),
        },
      })
    } catch (error) {
      console.error(
        `GET /api/organizers/${organizerId.data} failed:`,
        error,
      )
      fail(
        res,
        503,
        'ORGANIZER_UNAVAILABLE',
        'Unable to retrieve organizer profile from the database',
      )
    }
  })
  app.get('/api/demo/me', (req, res) => {
    const user = demoUser(req, res)
    if (user) ok(res, user, 'Demo identity; not a real login session')
  })
  app.get('/api/events/:eventId/reviews', async (req, res) => {
    if (!options.reviewReader) {
      fail(
        res,
        503,
        'DATABASE_NOT_CONFIGURED',
        'Event review database reader is not configured',
      )
      return
    }

    const eventId = z.string().uuid().safeParse(req.params.eventId)

    if (!eventId.success) {
      fail(res, 400, 'INVALID_EVENT_ID', 'Event ID must be a valid UUID')
      return
    }

    try {
      const reviews = await options.reviewReader(eventId.data)

      if (!reviews) {
        fail(res, 404, 'EVENT_NOT_FOUND', 'Event not found')
        return
      }

      res.json({
        success: true,
        message: 'Event reviews',
        data: reviews,
        meta: {
          mode: 'database',
          contractVersion: '1.0',
          asOf: now().toISOString(),
        },
      })
    } catch (error) {
      console.error(
        `GET /api/events/${eventId.data}/reviews failed:`,
        error,
      )
      fail(
        res,
        503,
        'REVIEWS_UNAVAILABLE',
        'Unable to retrieve event reviews from the database',
      )
    }
  })
  app.post('/api/events/:eventId/reviews', async (req, res) => {
    if (!options.reviewCreator) {
      fail(
        res,
        503,
        'DATABASE_NOT_CONFIGURED',
        'Event review database writer is not configured',
      )
      return
    }

    const eventId = z.string().uuid().safeParse(req.params.eventId)

    if (!eventId.success) {
      fail(res, 400, 'INVALID_EVENT_ID', 'Event ID must be a valid UUID')
      return
    }

    const parsed = createEventReviewSchema.safeParse(req.body)

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        code: 'INVALID_REVIEW_DATA',
        message: 'Please check the review details',
        errors: parsed.error.flatten(),
      })
      return
    }

    try {
      const input: CreateEventReviewInput = {
        eventId: eventId.data,
        userId: parsed.data.userId,
        rating: parsed.data.rating,
        comment: parsed.data.comment,
      }

      const review = await options.reviewCreator(input)

      res.status(201).json({
        success: true,
        message: 'Review created successfully',
        data: review,
        meta: {
          mode: 'database',
          contractVersion: '1.0',
          asOf: now().toISOString(),
        },
      })
    } catch (error) {
      console.error(
        `POST /api/events/${eventId.data}/reviews failed:`,
        error,
      )

      if (error instanceof Error) {
        if (error.message === 'EVENT_NOT_FOUND') {
          fail(res, 404, 'EVENT_NOT_FOUND', 'Event not found')
          return
        }

        if (error.message === 'PURCHASE_REQUIRED') {
          fail(
            res,
            403,
            'PURCHASE_REQUIRED',
            'You must complete a purchase for this event before reviewing it',
          )
          return
        }
      }

      // Prisma unique constraint violation: one review per customer per event.
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        fail(
          res,
          409,
          'REVIEW_ALREADY_EXISTS',
          'You have already reviewed this event',
        )
        return
      }

      fail(
        res,
        500,
        'REVIEW_CREATION_FAILED',
        'Unable to create event review',
      )
    }
  })
  const databaseProbe = options.databaseProbe
  if (databaseProbe) {
    app.get('/api/demo/database-check', async (_req, res) => {
      try {
        const user = await databaseProbe()
        if (!user) {
          fail(res, 404, 'SEED_USER_NOT_FOUND', 'Run the development identity seed first')
          return
        }
        ok(res, { database: 'PostgreSQL', seededUser: user }, 'Seeded development identity from the database')
      } catch {
        fail(res, 503, 'DATABASE_UNAVAILABLE', 'Database connection is unavailable')
      }
    })
  }
  app.get('/api/demo/me/rewards', (req, res) => {
    const user = demoUser(req, res)
    if (!user) return
    if (user.role !== 'CUSTOMER') {
      fail(res, 403, 'CUSTOMER_REQUIRED', 'Ticket checkout rewards require a customer')
      return
    }
    ok(res, walletFor(user.id, data.pointGrants, data.coupons, now()), 'Demo reward wallet')
  })
  app.get('/api/demo/checkout-context', (req, res) => {
    const user = demoUser(req, res)
    if (!user) return
    if (user.role !== 'CUSTOMER') {
      fail(res, 403, 'CUSTOMER_REQUIRED', 'Ticket checkout requires a customer')
      return
    }
    ok(
      res,
      {
        user,
        rewards: walletFor(user.id, data.pointGrants, data.coupons, now()),
      },
      'Read-only data for the F1 checkout prototype',
    )
  })
  app.get('/api/demo/organizers/:organizerId', (req, res) => {
    if (req.params.organizerId !== data.organizer.id) {
      fail(res, 404, 'ORGANIZER_NOT_FOUND', 'Organizer not found')
      return
    }
    ok(res, data.organizer, 'Demo organizer profile; review totals belong to F1')
  })
  app.use((_req, res) => fail(res, 404, 'NOT_FOUND', 'Endpoint not found'))
    const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    const errorCode =
      typeof error === 'object' && error !== null && 'code' in error
        ? error.code
        : undefined

    // File exceeds Multer's 5 MB limit.
    if (errorCode === 'LIMIT_FILE_SIZE') {
      fail(res, 413, 'FILE_TOO_LARGE', 'Image must be 5 MB or smaller')
      return
    }

    // Other Multer errors, such as unexpected file fields.
    if (
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'MulterError'
    ) {
      fail(res, 400, 'INVALID_UPLOAD', 'Unable to process the uploaded file')
      return
    }

    // File type rejected by our upload.ts fileFilter.
    if (
      error instanceof Error &&
      error.message === 'Only JPEG, PNG, and WebP images are allowed.'
    ) {
      fail(res, 400, 'INVALID_IMAGE', error.message)
      return
    }

    console.error('Unhandled API error:', error)
    fail(res, 500, 'INTERNAL_ERROR', 'Unexpected demo API error')
  }
  app.use(errorHandler)
  return app
}
