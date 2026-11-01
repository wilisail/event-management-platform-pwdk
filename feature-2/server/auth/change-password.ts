import { z } from 'zod'
import { hashPassword, newPasswordSchema, PasswordWorkLimitError, verifyPassword } from './passwords'

export interface PasswordRepository {
  findHash(userId: string): Promise<string | null>
  /** Recheck proof/session under the user lock; commit the hash and all-session revocation together. */
  replace(input: { userId: string; sessionId: string; expectedHash: string; nextHash: string }): Promise<'ok' | 'session-invalid' | 'conflict'>
}
export class PasswordChangeError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message) }
}
const inputSchema = z.strictObject({
  currentPassword: z.string().refine(value => [...value].length >= 1 && [...value].length <= 128),
  newPassword: newPasswordSchema,
})

export function createPasswordChangeService(options: {
  repository: PasswordRepository
  verify?: typeof verifyPassword
  hash?: typeof hashPassword
}) {
  return {
    async change(actor: { userId: string; sessionId: string }, input: unknown): Promise<void> {
      const parsed = inputSchema.safeParse(input)
      if (!parsed.success) throw new PasswordChangeError(400, 'INVALID_PASSWORD_CHANGE', 'Use the current password and a new password of 15–128 characters; no extra fields')
      const expectedHash = await options.repository.findHash(actor.userId)
      try {
        if (!expectedHash || !await (options.verify ?? verifyPassword)(parsed.data.currentPassword, expectedHash)) {
          throw new PasswordChangeError(400, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect')
        }
        if (parsed.data.currentPassword === parsed.data.newPassword) {
          throw new PasswordChangeError(400, 'PASSWORD_UNCHANGED', 'Choose a different new password')
        }
        // Slow password work is outside database locks; the repository rechecks this exact proof snapshot.
        const nextHash = await (options.hash ?? hashPassword)(parsed.data.newPassword)
        const result = await options.repository.replace({ ...actor, expectedHash, nextHash })
        if (result === 'session-invalid') throw new PasswordChangeError(401, 'SESSION_REQUIRED', 'Sign in to continue')
        if (result === 'conflict') throw new PasswordChangeError(409, 'PASSWORD_CHANGE_CONFLICT', 'Password changed during this request; sign in again')
      } catch (error) {
        if (error instanceof PasswordWorkLimitError) throw new PasswordChangeError(503, 'AUTH_BUSY', 'Password processing is busy; try again shortly')
        throw error
      }
    },
  }
}
export type PasswordChangeService = ReturnType<typeof createPasswordChangeService>
