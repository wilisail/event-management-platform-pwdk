import { createPasswordChangeService, type PasswordRepository } from '../../server/auth/change-password'
import { sessionFixture } from './sessions'

export function passwordFixture() {
  const f = sessionFixture()
  const repository: PasswordRepository = {
    async findHash(id) { return [...f.users.values()].find(user => user.id === id)?.passwordHash ?? null },
    async replace(input) {
      const account = [...f.users.values()].find(user => user.id === input.userId), session = f.sessions.get(input.sessionId)
      if (!session || session.user.id !== input.userId || session.revokedAt || session.expiresAt <= f.now()) return 'session-invalid'
      if (!account || account.passwordHash !== input.expectedHash) return 'conflict'
      account.passwordHash = input.nextHash
      for (const value of f.sessions.values()) if (value.user.id === input.userId && !value.revokedAt) value.revokedAt = f.now()
      return 'ok'
    },
  }
  const verify = async (password: string, encoded: string) => encoded === 'test-only:' + password
  const hash = async (password: string) => 'test-only:' + password
  return { ...f, passwordRepository: repository, verify, hash,
    passwordService: createPasswordChangeService({ repository, verify, hash }) }
}
