import type { LoginAccount, SessionRecord, SessionRepository } from '../../server/auth/sessions'
import { createSessionService } from '../../server/auth/sessions'
import { createSessionTokens } from '../../server/auth/session-tokens'

// Public test-only key; never read by the application bootstrap.
export const testSecret = 'ab'.repeat(32)
export const testAccount: LoginAccount = {
  id: '11111111-1111-4111-8111-111111111111', name: 'Session Customer',
  email: 'session@example.test', role: 'CUSTOMER', referralCode: 'TEST11223344',
  profilePictureUrl: null, passwordHash: 'test-only:correct long password',
}
export const loginFields = { email: testAccount.email, password: 'correct long password' }

export function memorySessions() {
  const users = new Map([[testAccount.email, { ...testAccount }]])
  const sessions = new Map<string, SessionRecord>()
  const tokens = new Map<string, { sessionId: string; expiresAt: Date; consumedAt: Date | null }>()
  const repository: SessionRepository = {
    async findLoginAccount(email) { return users.get(email) ?? null },
    async createSession(input) {
      const account = [...users.values()].find(user => user.id === input.userId)!
      const { passwordHash: _passwordHash, ...user } = account
      const session = { id: input.id, user, expiresAt: input.expiresAt, revokedAt: null }
      sessions.set(input.id, session)
      tokens.set(input.tokenHash, { sessionId: input.id, expiresAt: input.expiresAt, consumedAt: null })
      return session
    },
    async rotateRefresh(input) {
      // Synchronous state mutation models one serialized repository operation.
      const token = tokens.get(input.tokenHash)
      const session = token ? sessions.get(token.sessionId) : undefined
      if (!token || !session || session.revokedAt || session.expiresAt <= input.now || token.expiresAt <= input.now) {
        return { kind: 'invalid' }
      }
      if (token.consumedAt) { session.revokedAt = input.now; return { kind: 'reused' } }
      token.consumedAt = input.now
      tokens.set(input.nextTokenHash, { sessionId: session.id, expiresAt: session.expiresAt, consumedAt: null })
      return { kind: 'ok', session }
    },
    async revokeByRefreshHash(hash, now) {
      const token = tokens.get(hash)
      const session = token ? sessions.get(token.sessionId) : undefined
      if (session && !session.revokedAt) session.revokedAt = now
    },
    async findActiveSession(id, userId, now) {
      const session = sessions.get(id)
      if (!session || session.user.id !== userId || session.revokedAt || session.expiresAt <= now) return null
      const account = [...users.values()].find(user => user.id === userId)!
      return { ...session, user: { ...session.user, role: account.role } }
    },
  }
  return { users, sessions, tokens, repository }
}

export function sessionFixture() {
  const memory = memorySessions()
  let time = new Date('2026-10-31T07:00:00.000Z')
  const now = () => new Date(time)
  const service = createSessionService({
    repository: memory.repository, tokens: createSessionTokens(testSecret), now,
    verifyPassword: async (password, hash) => hash === 'test-only:' + password,
  })
  return { ...memory, service, now, advance: (ms: number) => { time = new Date(time.getTime() + ms) } }
}
