import express, { type ErrorRequestHandler, type Request, type Response } from 'express'
import { z } from 'zod'
import type { ApiSuccess, DemoPersona, UserView } from '../contracts/types'
import { walletFor } from '../domain/rewards'
import { createDemoData, type DemoData } from './fixtures'
import type { DatabaseUserView, PublicEventView } from './database'

export interface AppOptions {
  now?: () => Date
  data?: DemoData
  allowedOrigins?: string[]
  databaseProbe?: () => Promise<DatabaseUserView | null>
  eventsReader?: () => Promise<PublicEventView[]>
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
      res.set('Access-Control-Allow-Methods', 'GET,OPTIONS')
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
  app.get('/api/demo/me', (req, res) => {
    const user = demoUser(req, res)
    if (user) ok(res, user, 'Demo identity; not a real login session')
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
  const errorHandler: ErrorRequestHandler = (_error, _req, res, _next) => {
    fail(res, 500, 'INTERNAL_ERROR', 'Unexpected demo API error')
  }
  app.use(errorHandler)
  return app
}
