import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import type { Role, UserView } from '../../contracts/types'
import { hashPassword, newPasswordSchema, PasswordWorkLimitError } from './passwords'
import { addCalendarMonths, REFERRAL_AWARD_POINTS, REWARD_VALIDITY_MONTHS } from '../../domain/rewards'

// Project default from the accepted prototype; the PRD leaves the coupon value unspecified.
export const DEFAULT_REFERRAL_COUPON_IDR = 25_000

export const registrationSchema = z.object({
  name: z.string().trim().min(2, 'Enter at least 2 characters').max(100),
  email: z.string().trim().toLowerCase().max(254).email('Enter a valid email address'),
  password: newPasswordSchema,
  role: z.enum(['CUSTOMER', 'ORGANIZER']).default('CUSTOMER'),
  referralCode: z.string().trim().toUpperCase().max(16)
    .refine(value => value === '' || /^[A-Z0-9]+$/.test(value), 'Use the referral code as supplied').optional(),
}).strict()

export interface NewAccount {
  name: string
  email: string
  role: Role
  passwordHash: string
  referralCode: string
}

export interface RegistrationRepository {
  findUserIdByEmail(email: string): Promise<{ id: string } | null>
  /** With rewards, this entire operation must commit or roll back as one transaction. */
  createUser(data: NewAccount, rewards?: NewReferralRewards): Promise<UserView>
}

export interface NewReferralRewards {
  incomingCode: string
  couponCode: string
  points: number
  couponValue: number
  issuedAt: Date
  expiresAt: Date
}

export class RegistrationError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues?: Array<{ field: string; message: string }>,
  ) {
    super(message)
    this.name = 'RegistrationError'
  }
}

export interface RegistrationService {
  register(input: unknown): Promise<UserView>
}

export function createRegistrationService(options: {
  repository: RegistrationRepository
  passwordHasher?: (password: string) => Promise<string>
  referralCodeGenerator?: () => string
  couponCodeGenerator?: () => string
  referralCouponIdr?: number
  now?: () => Date
}): RegistrationService {
  const repository = options.repository
  const passwordHasher = options.passwordHasher ?? hashPassword
  const referralCodeGenerator = options.referralCodeGenerator ??
    (() => randomBytes(6).toString('hex').toUpperCase())
  const couponCodeGenerator = options.couponCodeGenerator ??
    (() => 'REF-' + randomBytes(10).toString('hex').toUpperCase())
  const couponValue = options.referralCouponIdr ?? DEFAULT_REFERRAL_COUPON_IDR
  if (!Number.isSafeInteger(couponValue) || couponValue <= 0) {
    throw new RangeError('REFERRAL_COUPON_IDR must be a positive safe integer')
  }
  const now = options.now ?? (() => new Date())
  const duplicateEmail = () => new RegistrationError(
    409, 'EMAIL_IN_USE', 'An account with this email already exists',
  )

  return {
    async register(input) {
      const parsed = registrationSchema.safeParse(input)
      if (!parsed.success) {
        throw new RegistrationError(400, 'INVALID_REGISTRATION', 'Check the registration fields',
          parsed.error.issues.map(issue => ({
            field: issue.path.map(String).join('.'), message: issue.message,
          })))
      }
      const data = parsed.data
      if (await repository.findUserIdByEmail(data.email)) throw duplicateEmail()

      let passwordHash: string
      try {
        passwordHash = await passwordHasher(data.password)
      } catch (error) {
        if (error instanceof PasswordWorkLimitError) {
          throw new RegistrationError(503, 'REGISTRATION_BUSY', 'Please try registering again shortly')
        }
        throw error
      }

      // Hashing stays outside the transaction so database locks do not cover expensive CPU work.
      const issuedAt = new Date(now().getTime())
      const expiresAt = addCalendarMonths(issuedAt, REWARD_VALIDITY_MONTHS)
      // Only known unique collisions retry. Each referral attempt is a fresh atomic bundle.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await repository.createUser({
            name: data.name, email: data.email, role: data.role,
            passwordHash, referralCode: referralCodeGenerator(),
          }, data.referralCode ? {
            incomingCode: data.referralCode, couponCode: couponCodeGenerator(),
            points: REFERRAL_AWARD_POINTS, couponValue, issuedAt, expiresAt,
          } : undefined)
        } catch (error) {
          if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'P2002') {
            throw error
          }
          if (await repository.findUserIdByEmail(data.email)) throw duplicateEmail()
          // Generated referral/coupon code collisions get fresh codes after full rollback.
        }
      }
      throw new RegistrationError(503, 'REFERRAL_CODE_UNAVAILABLE',
        'Account creation is temporarily unavailable. Please try again.')
    },
  }
}

