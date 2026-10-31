import { randomUUID } from 'node:crypto'
import type { UserView } from '../../contracts/types'
import type { NewAccount, RegistrationRepository } from '../../server/auth/registration'

export const registrationInput = {
  name: 'Registration Test',
  email: 'register@example.test',
  password: 'A long registration test password',
}

export function memoryRegistration(initial: UserView[] = []) {
  const users = new Map<string, UserView & { passwordHash: string }>()
  for (const user of initial) users.set(user.email, { ...user, passwordHash: 'fixture-only' })
  const calls = { hashes: 0, inserts: 0 }
  const repository: RegistrationRepository = {
    async findUserIdByEmail(email) {
      const user = users.get(email)
      return user ? { id: user.id } : null
    },
    async createUser(data: NewAccount) {
      calls.inserts++
      if (users.has(data.email) || [...users.values()].some(u => u.referralCode === data.referralCode)) {
        throw Object.assign(new Error('Unique constraint'), { code: 'P2002' })
      }
      const row = { ...data, id: randomUUID(), profilePictureUrl: null }
      users.set(data.email, row)
      const { passwordHash: _privateHash, ...safe } = row
      return safe
    },
  }
  return {
    users, calls, repository,
    passwordHasher: async (_password: string) => { calls.hashes++; return 'test-only-hash' },
  }
}
