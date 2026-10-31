import type { PrismaClient } from '../../generated/prisma/client'
import type { SessionRecord, SessionRepository } from './sessions'

type SessionDatabase = Pick<PrismaClient, 'user' | 'authSession' | 'authRefreshToken' | '$queryRaw'>
export type SessionTransaction = <T>(work: (tx: SessionDatabase) => Promise<T>) => Promise<T>
const userSelect = { id: true, name: true, email: true, role: true, referralCode: true } as const
const sessionInclude = { user: { select: userSelect } } as const
type StoredSession = { id: string; expiresAt: Date; revokedAt: Date | null; user: {
  id: string; name: string; email: string; role: 'CUSTOMER' | 'ORGANIZER'; referralCode: string
} }
const view = (session: StoredSession): SessionRecord => ({
  id: session.id, expiresAt: session.expiresAt, revokedAt: session.revokedAt,
  user: { ...session.user, profilePictureUrl: null },
})
const active = (session: StoredSession, now: Date) => !session.revokedAt && session.expiresAt > now

export function prismaSessionRepository(database: SessionDatabase, transaction: SessionTransaction): SessionRepository {
  async function lockSession(tx: SessionDatabase, id: string) {
    // All refresh/revocation paths serialize on the same parent row, including old tokens.
    await tx.$queryRaw`SELECT id FROM temuevent.auth_sessions WHERE id = ${id}::uuid FOR UPDATE`
  }
  return {
    async findLoginAccount(email) {
      const user = await database.user.findUnique({ where: { email }, select: { ...userSelect, passwordHash: true } })
      return user ? { ...user, profilePictureUrl: null } : null
    },
    createSession: input => transaction(async tx => {
      const session = await tx.authSession.create({
        data: {
          id: input.id, userId: input.userId, createdAt: input.now, expiresAt: input.expiresAt,
          refreshTokens: { create: { tokenHash: input.tokenHash, createdAt: input.now, expiresAt: input.expiresAt } },
        }, include: sessionInclude,
      })
      return view(session)
    }),
    rotateRefresh: input => transaction(async tx => {
      const lookup = await tx.authRefreshToken.findUnique({ where: { tokenHash: input.tokenHash }, select: { sessionId: true } })
      if (!lookup) return { kind: 'invalid' }
      await lockSession(tx, lookup.sessionId)
      // Re-read after the lock: a competing request may already have consumed/revoked it.
      const token = await tx.authRefreshToken.findUnique({
        where: { tokenHash: input.tokenHash }, include: { session: { include: sessionInclude } },
      })
      if (!token || !active(token.session, input.now) || token.expiresAt <= input.now) return { kind: 'invalid' }
      if (token.consumedAt) {
        await tx.authSession.update({ where: { id: token.sessionId }, data: { revokedAt: input.now } })
        // Return instead of throwing inside the transaction, so revocation commits.
        return { kind: 'reused' }
      }
      await tx.authRefreshToken.update({ where: { id: token.id }, data: { consumedAt: input.now } })
      await tx.authRefreshToken.create({ data: {
        sessionId: token.sessionId, tokenHash: input.nextTokenHash,
        createdAt: input.now, expiresAt: token.session.expiresAt,
      } })
      return { kind: 'ok', session: view(token.session) }
    }),
    revokeByRefreshHash: (tokenHash, now) => transaction(async tx => {
      const token = await tx.authRefreshToken.findUnique({ where: { tokenHash }, select: { sessionId: true } })
      if (!token) return
      await lockSession(tx, token.sessionId)
      await tx.authSession.updateMany({ where: { id: token.sessionId, revokedAt: null }, data: { revokedAt: now } })
    }),
    async findActiveSession(sessionId, userId, now) {
      const session = await database.authSession.findUnique({ where: { id: sessionId }, include: sessionInclude })
      return session && session.userId === userId && active(session, now) ? view(session) : null
    },
  }
}
