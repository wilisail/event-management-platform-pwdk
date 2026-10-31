import { Router, type Response } from 'express'
import { z } from 'zod'
import { authentication, requireAuthentication, requireRoles } from './auth/authorization'
import type { SessionService } from './auth/sessions'
import type { OrganizerReadRepository } from './organizer/reads'
import type { UserView } from '../contracts/types'

const pageInput = z.strictObject({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
})
const eventIdInput = z.uuid()
const publicUser = (user: Readonly<UserView>): UserView => ({
  id: user.id, name: user.name, email: user.email, role: user.role,
  referralCode: user.referralCode, profilePictureUrl: user.profilePictureUrl,
})
const fail = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ success: false, code, message })

export function protectedRouter(options: {
  sessionService?: SessionService
  organizerRepository?: OrganizerReadRepository
  secureCookies: boolean
}) {
  const router = Router()
  const signedIn = requireAuthentication(options.sessionService, options.secureCookies)
  const organizer = requireRoles('ORGANIZER')
  router.get('/me', signedIn, (_req, res) => {
    res.json({ success: true, message: 'Signed-in identity', data: publicUser(authentication(res)!.user) })
  })
  router.get('/organizer/events', signedIn, organizer, async (req, res) => {
    const query = pageInput.safeParse(req.query)
    if (!query.success) { fail(res, 400, 'INVALID_PAGINATION', 'Use page >= 1 and pageSize between 1 and 50'); return }
    const repository = options.organizerRepository
    if (!repository) { fail(res, 503, 'ORGANIZER_DATA_UNAVAILABLE', 'Organizer data is not configured'); return }
    try {
      const data = await repository.listEvents(authentication(res)!.user.id, query.data.page, query.data.pageSize)
      res.json({ success: true, message: 'Your events', data })
    } catch { fail(res, 503, 'ORGANIZER_DATA_UNAVAILABLE', 'Organizer data is temporarily unavailable') }
  })
  router.get('/organizer/events/:eventId/attendees', signedIn, organizer, async (req, res) => {
    const eventId = eventIdInput.safeParse(req.params.eventId), query = pageInput.safeParse(req.query)
    if (!eventId.success) { fail(res, 400, 'INVALID_EVENT_ID', 'Use a valid event UUID'); return }
    if (!query.success) { fail(res, 400, 'INVALID_PAGINATION', 'Use page >= 1 and pageSize between 1 and 50'); return }
    const repository = options.organizerRepository
    if (!repository) { fail(res, 503, 'ORGANIZER_DATA_UNAVAILABLE', 'Organizer data is not configured'); return }
    const organizerId = authentication(res)!.user.id
    try {
      if (!await repository.eventBelongsTo(organizerId, eventId.data)) {
        // Missing and someone else's event have the same response to avoid disclosing it.
        fail(res, 404, 'EVENT_NOT_FOUND', 'Event not found'); return
      }
      const data = await repository.listAttendees(organizerId, eventId.data, query.data.page, query.data.pageSize)
      res.json({ success: true, message: 'Confirmed attendee purchases', data })
    } catch { fail(res, 503, 'ORGANIZER_DATA_UNAVAILABLE', 'Organizer data is temporarily unavailable') }
  })
  return router
}
