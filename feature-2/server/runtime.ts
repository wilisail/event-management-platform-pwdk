import 'dotenv/config'
import { createApp } from './app'
import { createRegistrationService } from './auth/registration'
import { prismaRegistrationRepository } from './auth/registration-repository'
import { createSessionTokens } from './auth/session-tokens'
import { createSessionService } from './auth/sessions'
import { prismaSessionRepository } from './auth/session-repository'
import { createPasswordChangeService } from './auth/change-password'
import { prismaPasswordRepository } from './auth/password-repository'
import { prismaOrganizerReadRepository } from './organizer/read-repository'
import { prismaRewardReadRepository } from './rewards/read-repository'
import { prismaProfileRepository } from './profile/repository'
import { createProfileService } from './profile/service'
import { normalizePicture } from './profile/pictures'
import { supabaseProfileStorage } from './profile/storage'
import { featureOneOrganizerRating, type ReadOrganizerRating } from './profile/rating'

import { createPasswordResetService, resetOrigin } from './auth/password-reset'
import { prismaResetRepository } from './auth/reset-repository'
import { configuredMailer } from './email/provider'
import { createDecisionEmailWorker } from './email/organizer-decision'
import { prismaDecisionEmailRepository } from './email/organizer-decision-repository'
import type { PrismaClient } from '../generated/prisma/client'
import type { Mailer } from './email/resend'
import { prismaOrganizerProofReader, type PaymentProofStorage } from './organizer/private-proof'
import { supabasePaymentProofStorage } from './organizer/proof-storage'
import { prismaPurchaseTransitions } from './organizer/purchase-transitions'

const allowedOrigins = (
  process.env.F2_ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001'
)
  .split(',')
  .map(value => value.trim())
  .filter(Boolean)

export async function createRuntime(options: {
  defer?: (work: Promise<unknown>) => void; fallthrough?: boolean; allowedOrigins?: string[]; readOrganizerRating?: ReadOrganizerRating
  client?: PrismaClient; paymentProofStorage?: PaymentProofStorage; mailer?: Mailer; env?: Record<string, string | undefined>
} = {}) {
  const env = options.env ?? process.env
  const hasDatabase = Boolean(env.DATABASE_URL)
  const showDatabaseProbe = env.F2_DATABASE_CHECK_ENABLED === 'true' && env.NODE_ENV !== 'production'
  const database = hasDatabase || showDatabaseProbe ? await import('./database') : undefined
  const client = options.client ?? (hasDatabase ? database?.databaseClient() : undefined)
  const registrationService = client
    ? createRegistrationService({
        repository: prismaRegistrationRepository(client, work => client.$transaction(work, { timeout: 10000 })),
        referralCouponIdr: env.REFERRAL_COUPON_IDR === undefined
          ? undefined : Number(env.REFERRAL_COUPON_IDR),
      })
    : undefined
  const signingSecret = env.AUTH_JWT_SECRET
  const sessionService = client && signingSecret
    ? createSessionService({
        tokens: createSessionTokens(signingSecret),
        repository: prismaSessionRepository(client, work => client.$transaction(work, { timeout: 10000 })),
      })
    : undefined
  const pictureStorage = client ? supabaseProfileStorage(env) : undefined
  const configuredProofStorage = client && !options.paymentProofStorage ? supabasePaymentProofStorage(env) : undefined
  const proofStorage = options.paymentProofStorage ?? configuredProofStorage?.storage
  const deadlineStartAt = env.F2_PURCHASE_DEADLINE_START_AT ? new Date(env.F2_PURCHASE_DEADLINE_START_AT) : undefined
  const purchaseTransitions = client ? prismaPurchaseTransitions(client, { deadlineStartAt }) : undefined
  const profileService = client ? createProfileService({
    repository: prismaProfileRepository(client, work => client.$transaction(work, { timeout: 10000 })),
    normalize: normalizePicture, storage: pictureStorage?.storage,
    readOrganizerRating: options.readOrganizerRating ?? featureOneOrganizerRating(env.F1_PUBLIC_API_ORIGIN),
    onCleanupFailure: () => console.warn('Profile storage cleanup needs attention; check orphaned uploads.'),
  }) : undefined
  const mailer = options.mailer ?? configuredMailer(env), origin = resetOrigin(env)
  const decisionEmailWorker = client && mailer
    ? createDecisionEmailWorker(prismaDecisionEmailRepository(client), mailer,
      () => console.warn('Organizer decision email needs attention.')) : undefined
  const passwordResetService = client && signingSecret && mailer && origin
    ? createPasswordResetService({ repository: prismaResetRepository(client, work => client.$transaction(work, { timeout: 10000 })),
      signingSecret, mailer, origin, onDeliveryFailure: () => console.warn('Password recovery delivery needs attention; no account/token details logged.') }) : undefined
  const jobSecret = env.F2_JOB_RUNNER_SECRET
  const app = createApp({
    fallthrough: options.fallthrough,
    allowedOrigins: options.allowedOrigins ?? [...allowedOrigins, ...(env.VERCEL_ENV === 'preview' && env.VERCEL_URL ? ['https://' + env.VERCEL_URL] : [])], registrationService, sessionService, profileService, passwordResetService, defer: options.defer,
    passwordChangeService: client && sessionService ? createPasswordChangeService({
      repository: prismaPasswordRepository(client, work => client.$transaction(work, { timeout: 10000 })),
    }) : undefined,
    organizerRepository: client ? prismaOrganizerReadRepository(client) : undefined,
    organizerDecisionTransition: purchaseTransitions?.decide,
    organizerProofReader: client && proofStorage ? prismaOrganizerProofReader(client, proofStorage) : undefined,
    rewardRepository: client ? prismaRewardReadRepository(client, work => client.$transaction(work,
      { isolationLevel: 'RepeatableRead', timeout: 10000 })) : undefined,
    databaseProbe: showDatabaseProbe ? database?.readSeededDatabaseUser : undefined,
    checkReadiness: client && sessionService ? async () => {
      await client.$queryRaw`SELECT 1`
      if (!proofStorage) throw new Error('Private proof storage is required')
      await configuredProofStorage?.checkReadiness()
    } : undefined,
    scheduledEmailJobs: jobSecret ? {
      secret: jobSecret,
      passwordReset: passwordResetService?.dispatchPending,
      purchaseDeadlines: purchaseTransitions?.dispatchDeadlines,
      decisionEmails: env.F2_DECISION_EMAIL_WORKER_ENABLED === 'true'
        ? decisionEmailWorker?.dispatchPending : null,
    } : undefined,
  })
  return { app, sessionService, passwordResetService, decisionEmailWorker, purchaseTransitions, disconnect: database?.disconnectDatabase }
}
