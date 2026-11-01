import type { PrismaClient } from '../../generated/prisma/client'
import { ProfileError, type ProfileRepository } from './service'
import { profileSelect } from './views'

type ProfileDatabase = Pick<PrismaClient, 'user' | '$queryRaw'>
export type ProfileTransaction = <T>(work: (tx: ProfileDatabase) => Promise<T>) => Promise<T>

export function prismaProfileRepository(db: ProfileDatabase, transaction: ProfileTransaction): ProfileRepository {
  return {
    find: userId => db.user.findUnique({ where: { id: userId }, select: profileSelect }),
    findOrganizer: id => db.user.findFirst({ where: { id, role: 'ORGANIZER' }, select: profileSelect }),
    updateName: (userId, name) => db.user.update({ where: { id: userId }, data: { name }, select: profileSelect }),
    replacePicture: (userId, key) => transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM temuevent.users WHERE id = ${userId}::uuid FOR UPDATE`
      const previous = await tx.user.findUnique({ where: { id: userId }, select: { profilePictureKey: true } })
      if (!previous) throw new ProfileError(404, 'PROFILE_NOT_FOUND', 'Profile not found')
      const user = await tx.user.update({ where: { id: userId }, data: { profilePictureKey: key }, select: profileSelect })
      return { user, previousKey: previous.profilePictureKey }
    }),
  }
}
