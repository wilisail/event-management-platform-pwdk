import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '../../generated/prisma/client'
import { RESET_SECONDS, resetDigest, type ResetRecord, type ResetRepository } from './password-reset'

type ResetDatabase = Pick<PrismaClient, 'user' | 'authSession' | 'passwordResetToken' | '$queryRaw'>
export type ResetTransaction = <T>(work: (tx: ResetDatabase) => Promise<T>) => Promise<T>

export function prismaResetRepository(database: ResetDatabase, transaction: ResetTransaction,
  now = () => new Date()): ResetRepository {
  const eligible = (record: ResetRecord, hash: string | null | undefined, at: Date) =>
    Boolean(hash && record.userId && !record.consumedAt && record.expiresAt > at && record.credentialFingerprint === resetDigest(hash))
  return {
    enqueue: (email, input) => transaction(async tx => {
      // Transaction-scoped lock serializes cooldown even for addresses without an account.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${email}, 8247301))`
      const at = now()
      const recent = await tx.passwordResetToken.findFirst({ where: { recipientEmail: email,
        createdAt: { gt: new Date(at.getTime() - 60000) } }, select: { id: true } })
      if (recent || await tx.passwordResetToken.count({ where: { recipientEmail: email,
        createdAt: { gt: new Date(at.getTime() - 3600000) } } }) >= 3) return
      await tx.passwordResetToken.create({ data: { ...input, recipientEmail: email, createdAt: at,
        nextAttemptAt: at, expiresAt: new Date(at.getTime() + RESET_SECONDS * 1000) } })
    }),
    claim: () => transaction(async tx => {
      const at = now()
      const ids = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM temuevent.password_reset_tokens
        WHERE consumed_at IS NULL AND expires_at > ${at} AND attempt_count < 3
        AND ((delivery_state IN ('PENDING','RETRY') AND next_attempt_at <= ${at})
          OR (delivery_state = 'SENDING' AND leased_until <= ${at}))
        ORDER BY created_at, id FOR UPDATE SKIP LOCKED LIMIT 1`
      if (!ids[0]) return null
      return tx.passwordResetToken.update({ where: { id: ids[0].id }, data: { deliveryState: 'SENDING',
        leaseId: randomUUID(), leasedUntil: new Date(at.getTime() + 60000), attemptCount: { increment: 1 } } })
    }),
    activate: (job, expectedHash) => transaction(async tx => {
      const found = await tx.user.findUnique({ where: { email: job.recipientEmail }, select: { id: true } })
      if (found) await tx.$queryRaw`SELECT id FROM temuevent.users WHERE id = ${found.id}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM temuevent.password_reset_tokens WHERE id = ${job.id}::uuid FOR UPDATE`
      const current = await tx.passwordResetToken.findUnique({ where: { id: job.id } }), at = now()
      if (!current || current.leaseId !== job.leaseId || current.deliveryState !== 'SENDING' ||
        !current.leasedUntil || current.leasedUntil <= at) return null
      const user = found ? await tx.user.findUnique({ where: { id: found.id }, select: { email: true, passwordHash: true, createdAt: true } }) : null
      if (current.consumedAt || current.expiresAt <= at ||
        current.tokenHash !== expectedHash || !user?.passwordHash || user.email !== current.recipientEmail || user.createdAt > current.createdAt ||
        (current.userId && (current.userId !== found!.id || current.credentialFingerprint !== resetDigest(user.passwordHash)))) {
        await tx.passwordResetToken.update({ where: { id: job.id }, data: { deliveryState: 'SUPPRESSED', leaseId: null, leasedUntil: null } })
        return null
      }
      return tx.passwordResetToken.update({ where: { id: job.id }, data: {
        userId: found!.id, credentialFingerprint: resetDigest(user.passwordHash) } })
    }),
    async finish(job, accepted) {
      const at = now(), retry = !accepted && job.attemptCount < 3 && job.expiresAt > at
      await database.passwordResetToken.updateMany({ where: { id: job.id, leaseId: job.leaseId, deliveryState: 'SENDING' },
        data: { deliveryState: accepted ? 'ACCEPTED' : retry ? 'RETRY' : 'FAILED', leaseId: null, leasedUntil: null,
          nextAttemptAt: new Date(at.getTime() + 5000 * 2 ** (job.attemptCount - 1)) } })
    },
    async prune() {
      await database.passwordResetToken.updateMany({ where: { deliveryState: 'SENDING', attemptCount: 3, leasedUntil: { lte: now() } },
        data: { deliveryState: 'FAILED', leaseId: null, leasedUntil: null } })
      await database.passwordResetToken.deleteMany({ where: { createdAt: { lt: new Date(now().getTime() - 86400000) } } })
    },
    async candidate(tokenHash) {
      const record = await database.passwordResetToken.findUnique({ where: { tokenHash }, include: { user: { select: { passwordHash: true } } } })
      return record && eligible(record, record.user?.passwordHash, now()) ? record : null
    },
    redeem: input => transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM temuevent.users WHERE id = ${input.userId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM temuevent.password_reset_tokens WHERE id = ${input.id}::uuid AND user_id = ${input.userId}::uuid FOR UPDATE`
      const record = await tx.passwordResetToken.findUnique({ where: { id: input.id }, include: { user: { select: { passwordHash: true } } } })
      const at = now()
      if (!record || record.userId !== input.userId || record.tokenHash !== input.tokenHash || !eligible(record, record.user?.passwordHash, at)) return false
      await tx.user.update({ where: { id: input.userId }, data: { passwordHash: input.nextHash } })
      await tx.passwordResetToken.updateMany({ where: { OR: [{ userId: input.userId }, { recipientEmail: record.recipientEmail }], consumedAt: null }, data: { consumedAt: at } })
      await tx.authSession.updateMany({ where: { userId: input.userId, revokedAt: null }, data: { revokedAt: at } })
      return true
    }),
  }
}
