import type { UserView } from '../../contracts/types'

export const profileSelect = {
  id: true, name: true, email: true, role: true, referralCode: true, profilePictureKey: true,
} as const

export interface ProfileRecord {
  id: string
  name: string
  email: string
  role: 'CUSTOMER' | 'ORGANIZER'
  referralCode: string
  profilePictureKey: string | null
}

export function pictureUrl(key: string | null, organizerId?: string): string | null {
  if (!key) return null
  const base = organizerId ? '/api/organizers/' + encodeURIComponent(organizerId) + '/picture' : '/api/me/picture'
  return base + '?v=' + encodeURIComponent(key.split('/').at(-1)!)
}

/** Explicit projection: never return a storage credential/key or a password hash. */
export function profileUser(user: ProfileRecord): UserView {
  return { id: user.id, name: user.name, email: user.email, role: user.role,
    referralCode: user.referralCode, profilePictureUrl: pictureUrl(user.profilePictureKey) }
}
