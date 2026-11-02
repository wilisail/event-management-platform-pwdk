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

import { createPasswordResetService, resetOrigin } from './auth/password-reset'
import { prismaResetRepository } from './auth/reset-repository'
import { resendMailer } from './email/resend'

const allowedOrigins = (
  process.env.F2_ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001'
)
  .split(',')
  .map(value => value.trim())
  .filter(Boolean)

export async function createRuntime(options: { defer?: (work: Promise<void>) => void } = {}) {
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
  const pictureStorage = client ? supabaseProfileStorage() : undefined
  const profileService = client ? createProfileService({
    repository: prismaProfileRepository(client, work => client.$transaction(work, { timeout: 10000 })),
    normalize: normalizePicture, storage: pictureStorage?.storage,
    onCleanupFailure: () => console.warn('Profile storage cleanup needs attention; check orphaned uploads.'),
  }) : undefined
  const mailer = resendMailer(), origin = resetOrigin()
  const passwordResetService = client && signingSecret && mailer && origin
    ? createPasswordResetService({ repository: prismaResetRepository(client, work => client.$transaction(work, { timeout: 10000 })),
      signingSecret, mailer, origin, onDeliveryFailure: () => console.warn('Password recovery delivery needs attention; no account/token details logged.') }) : undefined
  const app = createApp({
    allowedOrigins: [...allowedOrigins, ...(process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL ? ['https://' + process.env.VERCEL_URL] : [])], registrationService, sessionService, profileService, passwordResetService, defer: options.defer,
    passwordChangeService: client && sessionService ? createPasswordChangeService({
      repository: prismaPasswordRepository(client, work => client.$transaction(work, { timeout: 10000 })),
    }) : undefined,
    organizerRepository: client ? prismaOrganizerReadRepository(client) : undefined,
    rewardRepository: client ? prismaRewardReadRepository(client, work => client.$transaction(work,
      { isolationLevel: 'RepeatableRead', timeout: 10000 })) : undefined,
    databaseProbe: showDatabaseProbe ? database?.readSeededDatabaseUser : undefined,
  })
  return { app, passwordResetService, disconnect: database?.disconnectDatabase }
}
