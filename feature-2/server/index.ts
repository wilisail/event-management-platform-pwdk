import 'dotenv/config'
import { createApp } from './app'
import { createRegistrationService } from './auth/registration'
import { prismaRegistrationRepository } from './auth/registration-repository'
import { createSessionTokens } from './auth/session-tokens'
import { createSessionService } from './auth/sessions'
import { prismaSessionRepository } from './auth/session-repository'
import { prismaOrganizerReadRepository } from './organizer/read-repository'

const port = Number(process.env.F2_API_PORT || 4002)
const host = process.env.F2_API_HOST || '127.0.0.1'
const allowedOrigins = (
  process.env.F2_ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001'
)
  .split(',')
  .map(value => value.trim())
  .filter(Boolean)

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid F2_API_PORT')

async function start() {
  const hasDatabase = Boolean(process.env.DATABASE_URL)
  const showDatabaseProbe = process.env.F2_DATABASE_CHECK_ENABLED === 'true' &&
    process.env.NODE_ENV !== 'production'
  const database = hasDatabase || showDatabaseProbe ? await import('./database') : undefined
  const client = hasDatabase ? database?.databaseClient() : undefined
  const registrationService = client
    ? createRegistrationService({
        repository: prismaRegistrationRepository(client, work => client.$transaction(work, { timeout: 10000 })),
        referralCouponIdr: process.env.REFERRAL_COUPON_IDR === undefined
          ? undefined : Number(process.env.REFERRAL_COUPON_IDR),
      })
    : undefined
  const signingSecret = process.env.AUTH_JWT_SECRET
  const sessionService = client && signingSecret
    ? createSessionService({
        tokens: createSessionTokens(signingSecret),
        repository: prismaSessionRepository(client, work => client.$transaction(work, { timeout: 10000 })),
      })
    : undefined
  const server = createApp({
    allowedOrigins, registrationService, sessionService,
    organizerRepository: client ? prismaOrganizerReadRepository(client) : undefined,
    databaseProbe: showDatabaseProbe ? database?.readSeededDatabaseUser : undefined,
  }).listen(port, host, () => {
    console.log('Feature 2 API: http://' + host + ':' + port)
    console.log(registrationService
      ? 'Registration is database-backed; account/reward preview routes still use demo fixtures.'
      : 'Registration is unavailable until DATABASE_URL is configured; demo routes remain available.')
    console.log(sessionService ? 'Login, refresh and logout use persisted database sessions.'
      : 'Sessions are unavailable until DATABASE_URL and AUTH_JWT_SECRET are configured.')
  })
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      server.close(() => {
        void database?.disconnectDatabase().finally(() => process.exit(0))
        if (!database) process.exit(0)
      })
    })
  }
}

start().catch(() => {
  console.error('Unable to start the API. Check the backend configuration.')
  process.exitCode = 1
})


