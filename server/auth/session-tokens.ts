import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import { z } from 'zod'

export const ACCESS_SECONDS = 15 * 60
export const SESSION_SECONDS = 7 * 24 * 60 * 60
const issuer = 'temuevent-api'
const audience = 'temuevent-web'
const refreshPattern = /^[A-Za-z0-9_-]{43}$/
const identity = z.object({ sub: z.uuid(), sid: z.uuid() })

export function validRefreshToken(value: unknown): value is string {
  return typeof value === 'string' && refreshPattern.test(value)
}

// Random 256-bit secrets need a fast digest; human passwords need slow scrypt instead.
export function hashRefreshToken(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function createSessionTokens(secretHex: string) {
  if (!/^[a-fA-F0-9]{64}$/.test(secretHex)) {
    throw new Error('AUTH_JWT_SECRET must contain 64 hexadecimal characters')
  }
  const key = Buffer.from(secretHex, 'hex')
  return {
    newRefreshToken: () => randomBytes(32).toString('base64url'),
    async signAccess(userId: string, sessionId: string, issuedAt: Date, expiresAt: Date) {
      return new SignJWT({ sid: sessionId })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuer(issuer).setAudience(audience).setSubject(userId).setJti(randomUUID())
        .setIssuedAt(Math.floor(issuedAt.getTime() / 1000))
        .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
        .sign(key)
    },
    async verifyAccess(value: string, now: Date): Promise<{ userId: string; sessionId: string } | null> {
      if (value.length > 2048) return null
      try {
        const { payload } = await jwtVerify(value, key, {
          algorithms: ['HS256'], typ: 'JWT', issuer, audience, currentDate: now,
          requiredClaims: ['sub', 'sid', 'iat', 'exp', 'jti'], maxTokenAge: ACCESS_SECONDS,
        })
        const parsed = identity.safeParse(payload)
        if (!parsed.success || typeof payload.iat !== 'number' || typeof payload.exp !== 'number' ||
          payload.exp > payload.iat + ACCESS_SECONDS) return null
        return { userId: parsed.data.sub, sessionId: parsed.data.sid }
      } catch { return null }
    },
    csrfToken(refreshToken: string): string {
      return createHmac('sha256', key).update('temuevent:csrf:v1:' + refreshToken).digest('base64url')
    },
    verifyCsrf(refreshToken: string, csrfToken: unknown): boolean {
      if (typeof csrfToken !== 'string' || !refreshPattern.test(csrfToken)) return false
      const expected = this.csrfToken(refreshToken)
      return timingSafeEqual(Buffer.from(expected), Buffer.from(csrfToken))
    },
  }
}

export type SessionTokens = ReturnType<typeof createSessionTokens>
