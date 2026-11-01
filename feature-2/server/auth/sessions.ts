import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { UserView } from '../../contracts/types'
import { PasswordWorkLimitError, verifyPassword } from './passwords'
import { ACCESS_SECONDS, SESSION_SECONDS, hashRefreshToken, validRefreshToken, type SessionTokens } from './session-tokens'

export interface SessionRecord {
  id: string
  user: UserView
  expiresAt: Date
  revokedAt: Date | null
}
export interface LoginAccount extends UserView { passwordHash: string | null }
export type RotationResult = { kind: 'ok'; session: SessionRecord } | { kind: 'invalid' | 'reused' }
export interface SessionRepository {
  findLoginAccount(email: string): Promise<LoginAccount | null>
  createSession(input: { id: string; userId: string; expectedPasswordHash: string; tokenHash: string; now: Date; expiresAt: Date }): Promise<SessionRecord | null>
  rotateRefresh(input: { tokenHash: string; nextTokenHash: string; now: Date }): Promise<RotationResult>
  revokeByRefreshHash(tokenHash: string, now: Date): Promise<void>
  findActiveSession(sessionId: string, userId: string, now: Date): Promise<SessionRecord | null>
  isCurrentRefreshForSession(tokenHash: string, sessionId: string, now: Date): Promise<boolean>
}
export interface SessionCredentials {
  user: UserView
  accessToken: string
  refreshToken: string
  csrfToken: string
  accessExpiresAt: Date
  sessionExpiresAt: Date
}
export class SessionError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message)
    this.name = 'SessionError'
  }
}

const loginInput = z.strictObject({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().refine(value => [...value].length >= 1 && [...value].length <= 128),
})
// A supported-cost dummy hash equalizes password work for missing/passwordless accounts.
// Its salt/hash are not credentials; no account stores or accepts this value.
const dummyHash = 'scrypt-v1$32768$8$3$' + '00'.repeat(16) + '$' + '00'.repeat(64)
const unauthenticated = () => new SessionError(401, 'SESSION_REQUIRED', 'Sign in to continue')

export function createSessionService(options: {
  repository: SessionRepository
  tokens: SessionTokens
  now?: () => Date
  verifyPassword?: typeof verifyPassword
}) {
  const { repository, tokens } = options
  const now = options.now ?? (() => new Date())
  const verify = options.verifyPassword ?? verifyPassword

  async function credentials(session: SessionRecord, refreshToken: string, issuedAt: Date): Promise<SessionCredentials> {
    const accessExpiresAt = new Date(Math.min(issuedAt.getTime() + ACCESS_SECONDS * 1000, session.expiresAt.getTime()))
    return {
      user: session.user, refreshToken, csrfToken: tokens.csrfToken(refreshToken),
      accessToken: await tokens.signAccess(session.user.id, session.id, issuedAt, accessExpiresAt),
      accessExpiresAt, sessionExpiresAt: session.expiresAt,
    }
  }

  return {
    async login(input: unknown): Promise<SessionCredentials> {
      const parsed = loginInput.safeParse(input)
      if (!parsed.success) throw new SessionError(400, 'INVALID_LOGIN', 'Enter a valid email and password')
      const account = await repository.findLoginAccount(parsed.data.email)
      const expectedPasswordHash = account?.passwordHash
      let valid: boolean
      try { valid = await verify(parsed.data.password, expectedPasswordHash ?? dummyHash) }
      catch (error) {
        if (error instanceof PasswordWorkLimitError) throw new SessionError(503, 'AUTH_BUSY', 'Sign in is busy. Try again shortly')
        throw error
      }
      if (!valid || !expectedPasswordHash || !account) {
        throw new SessionError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect')
      }
      const issuedAt = now()
      const refreshToken = tokens.newRefreshToken()
      const session = await repository.createSession({
        id: randomUUID(), userId: account.id, now: issuedAt,
        expectedPasswordHash,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(issuedAt.getTime() + SESSION_SECONDS * 1000),
      })
      if (!session) throw new SessionError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect')
      return credentials(session, refreshToken, issuedAt)
    },
    async refresh(refreshToken: string | null): Promise<SessionCredentials> {
      if (!validRefreshToken(refreshToken)) throw unauthenticated()
      const issuedAt = now()
      const nextToken = tokens.newRefreshToken()
      const result = await repository.rotateRefresh({
        tokenHash: hashRefreshToken(refreshToken), nextTokenHash: hashRefreshToken(nextToken), now: issuedAt,
      })
      if (result.kind !== 'ok') throw unauthenticated()
      return credentials(result.session, nextToken, issuedAt)
    },
    async logout(refreshToken: string | null): Promise<void> {
      if (validRefreshToken(refreshToken)) await repository.revokeByRefreshHash(hashRefreshToken(refreshToken), now())
    },
    async readSession(accessToken: string | null): Promise<SessionRecord> {
      if (!accessToken) throw unauthenticated()
      const at = now()
      const identity = await tokens.verifyAccess(accessToken, at)
      if (!identity) throw unauthenticated()
      const session = await repository.findActiveSession(identity.sessionId, identity.userId, at)
      if (!session) throw unauthenticated()
      return session
    },
    csrfToken(refreshToken: string | null): string {
      if (!validRefreshToken(refreshToken)) throw unauthenticated()
      return tokens.csrfToken(refreshToken)
    },
    verifyCsrf(refreshToken: string | null, csrfToken: unknown): boolean {
      return validRefreshToken(refreshToken) && tokens.verifyCsrf(refreshToken, csrfToken)
    },
    async verifySessionCsrf(sessionId: string, refreshToken: string | null, csrfToken: unknown): Promise<boolean> {
      if (!validRefreshToken(refreshToken) || !tokens.verifyCsrf(refreshToken, csrfToken)) return false
      return repository.isCurrentRefreshForSession(hashRefreshToken(refreshToken), sessionId, now())
    },
  }
}

export type SessionService = ReturnType<typeof createSessionService>
