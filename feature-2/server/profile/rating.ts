import { z } from 'zod'
import type { OrganizerView } from '../../contracts/types'
import { featureOneOrigin } from '../../lib/feature-one-links'

export const ratingProjectionHeader = 'x-temuevent-rating-projection'
export type ReadOrganizerRating = (organizerId: string) => Promise<OrganizerView['ratingSummary']>

const publicReviews = z.object({ success: z.literal(true), data: z.object({
  organizer: z.object({ id: z.uuid() }), reviews: z.array(z.object({ rating: z.number().int().min(1).max(5) })),
}) })

export function featureOneOrganizerRating(configuredOrigin: string | undefined, transport: typeof fetch = fetch): ReadOrganizerRating | undefined {
  const origin = featureOneOrigin(configuredOrigin)
  if (!origin) return undefined
  return async organizerId => {
    if (!z.uuid().safeParse(organizerId).success) return null
    try {
      const response = await transport(origin + '/api/organizers/' + encodeURIComponent(organizerId), {
        headers: { accept: 'application/json', [ratingProjectionHeader]: '1' },
        cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(2500),
      })
      if (!response.ok) return null
      const parsed = publicReviews.safeParse(await response.json())
      if (!parsed.success || parsed.data.data.organizer.id.toLowerCase() !== organizerId.toLowerCase()) return null
      const { reviews } = parsed.data.data
      return { average: reviews.length ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length : 0,
        count: reviews.length }
    } catch { return null }
  }
}
