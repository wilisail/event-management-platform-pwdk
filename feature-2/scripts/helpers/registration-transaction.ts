import type { Prisma } from '../../generated/prisma/client'
import type { RegistrationTransaction } from '../../server/auth/registration-repository'

/** QA only: nest atomic attempts in a single outer transaction that will be rolled back. */
export function registrationSavepoints(tx: Prisma.TransactionClient): RegistrationTransaction {
  let sequence = 0
  return async work => {
    const name = 'registration_attempt_' + ++sequence
    await tx.$executeRawUnsafe('SAVEPOINT ' + name)
    try {
      const result = await work(tx)
      await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + name)
      return result
    } catch (error) {
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ' + name)
      await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + name)
      throw error
    }
  }
}
