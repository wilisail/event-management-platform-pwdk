import type { PrismaClient } from '../../generated/prisma/client'
import type { RegistrationRepository } from './registration'

export function prismaRegistrationRepository(
  database: Pick<PrismaClient, 'user'>,
): RegistrationRepository {
  return {
    findUserIdByEmail: email => database.user.findUnique({
      where: { email }, select: { id: true },
    }),
    async createUser(data) {
      const user = await database.user.create({
        data,
        select: { id: true, name: true, email: true, role: true, referralCode: true },
      })
      return { ...user, profilePictureUrl: null }
    },
  }
}
