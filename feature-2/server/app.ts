import express, { type ErrorRequestHandler, type Request, type Response } from 'express'
import { z } from 'zod'
import { rateLimit } from 'express-rate-limit'
import { RegistrationError, type RegistrationService } from './auth/registration'
import { sessionRouter } from './auth/session-http'
import type { SessionService } from './auth/sessions'
import { protectedRouter } from './protected-http'
import type { OrganizerReadRepository } from './organizer/reads'
import type { RewardReadRepository } from './rewards/reads'
import type { ApiSuccess, DemoPersona, UserView } from '../contracts/types'
import { walletFor } from '../domain/rewards'
import { createDemoData, type DemoData } from './fixtures'
import type { DatabaseUserView } from './database'
import { profileRouter } from './profile/http'
import type { ProfileService } from './profile/service'

export interface AppOptions {
  now?: () => Date
  data?: DemoData
  allowedOrigins?: string[]
  databaseProbe?: () => Promise<DatabaseUserView | null>
  registrationService?: RegistrationService
  registrationRateLimit?: { limit: number; windowMs: number }
  sessionService?: SessionService
  secureCookies?: boolean
  loginRateLimit?: { limit: number; windowMs: number }
  organizerRepository?: OrganizerReadRepository
  rewardRepository?: RewardReadRepository
  profileService?: ProfileService
}

export function createApp(options: AppOptions = {}) {
  const now = options.now ?? (() => new Date())
  const data = options.data ?? createDemoData(now())
  const allowedOrigins = options.allowedOrigins ?? [
    'http://localhost:3000',
    'http://localhost:3001',
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
      res.set('Access-Control-Allow-Headers', 'content-type,x-demo-persona,x-temuevent-client,x-csrf-token')
      res.set('Access-Control-Allow-Credentials', 'true')
      res.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS')
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
    ok(res, {
      service: 'feature-2-api', readOnly: !options.registrationService && !options.sessionService,
      registrationConfigured: Boolean(options.registrationService),
      sessionsConfigured: Boolean(options.sessionService),
    }, 'Feature 2 API ready'),
  )

  const registrationLimiter = rateLimit({
    windowMs: options.registrationRateLimit?.windowMs ?? 15 * 60 * 1000,
    limit: options.registrationRateLimit?.limit ?? 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => fail(res, 429, 'REGISTRATION_RATE_LIMITED',
      'Too many registration attempts. Please try again later'),
  })
  app.post('/api/auth/register',
    registrationLimiter,
    (req, res, next) => {
      if (!req.is('application/json')) {
        fail(res, 415, 'JSON_REQUIRED', 'Send registration fields as JSON')
        return
      }
      next()
    },
    express.json({ limit: '8kb', strict: true }),
    async (req, res) => {
      if (!options.registrationService) {
        fail(res, 503, 'REGISTRATION_UNAVAILABLE', 'Account registration is not configured')
        return
      }
      try {
        const account = await options.registrationService.register(req.body)
        const user: UserView = {
          id: account.id, name: account.name, email: account.email, role: account.role,
          referralCode: account.referralCode, profilePictureUrl: account.profilePictureUrl,
        }
        res.set('Cache-Control', 'no-store')
        res.status(201).json({
          success: true, message: 'Account created. Sign in to continue.', data: { user },
        })
      } catch (error) {
        if (error instanceof RegistrationError) {
          if (error.status === 503) res.set('Retry-After', '2')
          res.status(error.status).json({
            success: false, code: error.code, message: error.message,
            ...(error.issues ? { issues: error.issues } : {}),
          })
          return
        }
        fail(res, 503, 'REGISTRATION_UNAVAILABLE', 'Account registration is temporarily unavailable')
      }
    },
  )

  app.use('/api/auth', sessionRouter({
    service: options.sessionService, now,
    secureCookies: options.secureCookies ?? process.env.NODE_ENV === 'production',
    loginLimit: options.loginRateLimit,
  }))
  app.use('/api', protectedRouter({
    sessionService: options.sessionService, organizerRepository: options.organizerRepository,
    rewardRepository: options.rewardRepository, now,
    secureCookies: options.secureCookies ?? process.env.NODE_ENV === 'production',
  }))
  app.use('/api', profileRouter({ service: options.profileService, sessions: options.sessionService,
    secureCookies: options.secureCookies ?? process.env.NODE_ENV === 'production' }))

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
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error?.type === 'entity.too.large') {
      fail(res, 413, 'REQUEST_TOO_LARGE', 'The API request is too large')
      return
    }
    if (error?.type === 'entity.parse.failed') {
      fail(res, 400, 'INVALID_JSON', 'Send valid JSON fields')
      return
    }
    if (error?.type === 'encoding.unsupported') {
      fail(res, 415, 'ENCODING_UNSUPPORTED', 'Send an uncompressed image')
      return
    }
    fail(res, 500, 'INTERNAL_ERROR', 'Unexpected API error')
  }
  app.use(errorHandler)
  return app
}

