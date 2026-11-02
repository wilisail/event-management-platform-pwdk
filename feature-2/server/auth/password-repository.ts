import type { PrismaClient } from '../../generated/prisma/client'
import type { PasswordRepository } from './change-password'

type PasswordDatabase = Pick<PrismaClient, 'user' | 'authSession' | 'passwordResetToken' | '$queryRaw'>
type PasswordTransaction = <T>(work: (tx: PasswordDatabase) => Promise<T>) => Promise<T>

export function prismaPasswordRepository(database: PasswordDatabase, transaction: PasswordTransaction,
  now = () => new Date()): PasswordRepository {
  return {
    async findHash(userId) {
      return (await database.user.findUnique({ where: { id: userId }, select: { passwordHash: true } }))?.passwordHash ?? null
    },
    replace: input => transaction(async tx => {
      // Login creation takes this same user lock. No session can escape the password/revocation boundary.
      await tx.$queryRaw`SELECT id FROM temuevent.users WHERE id = ${input.userId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM temuevent.auth_sessions
        WHERE id = ${input.sessionId}::uuid AND user_id = ${input.userId}::uuid FOR UPDATE`
      const at = now()
      const session = await tx.authSession.findFirst({ where: { id: input.sessionId, userId: input.userId,
        revokedAt: null, expiresAt: { gt: at } }, select: { id: true } })
      if (!session) return 'session-invalid'
      const current = await tx.user.findUnique({ where: { id: input.userId }, select: { passwordHash: true, email: true } })
      if (!current?.passwordHash || current.passwordHash !== input.expectedHash) return 'conflict'
      await tx.user.update({ where: { id: input.userId }, data: { passwordHash: input.nextHash } })
      await tx.passwordResetToken.updateMany({ where: { OR: [{ userId: input.userId }, { recipientEmail: current.email }],
        consumedAt: null }, data: { consumedAt: at } })
      await tx.authSession.updateMany({ where: { userId: input.userId, revokedAt: null }, data: { revokedAt: at } })
      return 'ok'
    }),
  }
}
