import { Router, json, type Response } from 'express'
import { z } from 'zod'
import { authentication, requireAuthentication, requireCsrf, requireRoles } from './auth/authorization'
import type { SessionService } from './auth/sessions'
import type { OrganizerReadRepository } from './organizer/reads'
import { decisionAvailability, type OrganizerDecisionTransition } from './organizer/decision'
import { PURCHASE_STATUSES, STATISTICS_GROUPS, type UserView } from '../contracts/types'
import { statisticsRange } from './organizer/statistics'
import type { RewardReadRepository } from './rewards/reads'
import { REFERRAL_AWARD_POINTS, REWARD_VALIDITY_MONTHS } from '../domain/rewards'

const pageInput = z.strictObject({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
})
const eventIdInput = z.uuid()
const transactionQuery = pageInput.extend({ status: z.enum(PURCHASE_STATUSES).optional() })
const decisionInput = z.strictObject({ decision: z.enum(['ACCEPT', 'REJECT']) })
const attendanceInput = z.strictObject({ customerId: z.uuid(), transactionId: z.uuid() })
const statisticsQuery = z.strictObject({
  groupBy: z.enum(STATISTICS_GROUPS).default('day'), from: z.iso.date().optional(), to: z.iso.date().optional(),
})
const walletInput = z.strictObject({
  pointPage: z.coerce.number().int().min(1).max(1000).default(1),
  couponPage: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
})
const publicUser = (user: Readonly<UserView>): UserView => ({
  id: user.id, name: user.name, email: user.email, role: user.role,
  referralCode: user.referralCode, profilePictureUrl: user.profilePictureUrl,
})
const fail = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ success: false, code, message })

export function protectedRouter(options: {
  sessionService?: SessionService
  organizerRepository?: OrganizerReadRepository
  organizerDecisionTransition?: OrganizerDecisionTransition
  rewardRepository?: RewardReadRepository
  now?: () => Date
  secureCookies: boolean
}) {
  const router = Router()
  const signedIn = requireAuthentication(options.sessionService, options.secureCookies)
  const organizer = requireRoles('ORGANIZER')
  const csrf = requireCsrf(options.sessionService, options.secureCookies)
  const now = options.now ?? (() => new Date())
  router.get('/me', signedIn, (_req, res) => {
    res.json({ success: true, message: 'Signed-in identity', data: publicUser(authentication(res)!.user) })
  })
  router.get('/me/referral', signedIn, async (req, res) => {
    if (Object.keys(req.query).length) { fail(res, 400, 'INVALID_REFERRAL_QUERY', 'No query fields are supported'); return }
    const repository = options.rewardRepository
    if (!repository) { fail(res, 503, 'REWARDS_UNAVAILABLE', 'Rewards are not configured'); return }
    try {
      const user = authentication(res)!.user
      const referredCount = await repository.countReferrals(user.id)
      res.json({ success: true, message: 'Your referral summary', data: {
        code: user.referralCode, referredCount,
        referralAwardPoints: REFERRAL_AWARD_POINTS, validityCalendarMonths: REWARD_VALIDITY_MONTHS,
      } })
    } catch { fail(res, 503, 'REWARDS_UNAVAILABLE', 'Rewards are temporarily unavailable') }
  })
  router.get('/me/rewards', signedIn, requireRoles('CUSTOMER'), async (req, res) => {
    const query = walletInput.safeParse(req.query)
    if (!query.success) { fail(res, 400, 'INVALID_WALLET_QUERY', 'Use pointPage/couponPage 1–1000 and pageSize 1–50'); return }
    const repository = options.rewardRepository
    if (!repository) { fail(res, 503, 'REWARDS_UNAVAILABLE', 'Rewards are not configured'); return }
    try {
      const data = await repository.wallet(authentication(res)!.user.id, (options.now ?? (() => new Date()))(), query.data)
      res.json({ success: true, message: 'Your reward wallet', data })
    } catch { fail(res, 503, 'REWARDS_UNAVAILABLE', 'Rewards are temporarily unavailable') }
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
  router.get('/organizer/statistics', signedIn, organizer, async (req, res) => {
    const query = statisticsQuery.safeParse(req.query)
    const range = query.success ? statisticsRange(query.data, now()) : null
    if (!range) { fail(res, 400, 'INVALID_STATISTICS_RANGE', 'Use a valid local date range and day, month or year grouping'); return }
    const repository = options.organizerRepository
    if (!repository?.statistics) { fail(res, 503, 'ORGANIZER_DATA_UNAVAILABLE', 'Organizer data is not configured'); return }
    try {
      const data = await repository.statistics(authentication(res)!.user.id, range)
      res.json({ success: true, message: 'Your event statistics', data })
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
  router.post('/organizer/events/:eventId/attendance', signedIn, organizer, csrf, (req, res, next) => {
    if (!req.is('application/json')) { fail(res, 415, 'JSON_REQUIRED', 'Send attendance details as JSON'); return }
    next()
  }, json({ limit: '1kb', strict: true }), async (req, res) => {
    const eventId = eventIdInput.safeParse(req.params.eventId)
    const input = attendanceInput.safeParse(req.body)
    if (!eventId.success || !input.success || Object.keys(req.query).length) {
      fail(res, 400, 'INVALID_ATTENDANCE', 'Use valid event, customer and transaction IDs'); return
    }
    const repository = options.organizerRepository
    if (!repository?.markAttendance) { fail(res, 503, 'ATTENDANCE_UNAVAILABLE', 'Attendance is not configured'); return }
    try {
      const data = await repository.markAttendance(authentication(res)!.user.id, eventId.data, input.data.customerId, input.data.transactionId)
      if (!data) { fail(res, 404, 'ATTENDANCE_PURCHASE_NOT_FOUND', 'Confirmed purchase not found'); return }
      res.json({ success: true, message: 'Attendance recorded', data })
    } catch { fail(res, 503, 'ATTENDANCE_UNCERTAIN', 'Reload the attendee list before trying again') }
  })
  router.use('/organizer/transactions', (_req, res, next) => {
    res.set('Cache-Control', 'private, no-store')
    next()
  })
  router.get('/organizer/transactions', signedIn, organizer, async (req, res) => {
    const query = transactionQuery.safeParse(req.query)
    if (!query.success) { fail(res, 400, 'INVALID_TRANSACTION_QUERY', 'Invalid status or pagination'); return }
    const transactions = options.organizerRepository?.transactions
    if (!transactions) { fail(res, 503, 'ORGANIZER_DATA_UNAVAILABLE', 'Organizer data is not configured'); return }
    try {
      const data = await transactions.list(authentication(res)!.user.id, query.data)
      res.json({ success: true, message: 'Your event transactions', data })
    } catch { fail(res, 503, 'ORGANIZER_DATA_UNAVAILABLE', 'Organizer data is temporarily unavailable') }
  })
  router.get('/organizer/transactions/:transactionId', signedIn, organizer, async (req, res) => {
    const transactionId = z.uuid().safeParse(req.params.transactionId)
    if (!transactionId.success) { fail(res, 400, 'INVALID_TRANSACTION_ID', 'Use a valid transaction UUID'); return }
    const transactions = options.organizerRepository?.transactions
    if (!transactions) { fail(res, 503, 'ORGANIZER_DATA_UNAVAILABLE', 'Organizer data is not configured'); return }
    try {
      const data = await transactions.detail(authentication(res)!.user.id, transactionId.data)
      if (!data) { fail(res, 404, 'TRANSACTION_NOT_FOUND', 'Transaction not found'); return }
      res.json({ success: true, message: 'Transaction details', data: {
        ...data, decisionAvailability: decisionAvailability(data, now(), options.organizerDecisionTransition),
      } })
    } catch { fail(res, 503, 'ORGANIZER_DATA_UNAVAILABLE', 'Organizer data is temporarily unavailable') }
  })
  router.post('/organizer/transactions/:transactionId/decision', signedIn, organizer, csrf, (req, res, next) => {
    if (!req.is('application/json')) { fail(res, 415, 'JSON_REQUIRED', 'Send the decision as JSON'); return }
    next()
  }, json({ limit: '1kb', strict: true }), async (req, res) => {
    const transactionId = z.uuid().safeParse(req.params.transactionId)
    const input = decisionInput.safeParse(req.body)
    if (!transactionId.success || !input.success || Object.keys(req.query).length) {
      fail(res, 400, 'INVALID_DECISION', 'Use a transaction UUID and an ACCEPT or REJECT decision'); return
    }
    const transactions = options.organizerRepository?.transactions
    if (!transactions) { fail(res, 503, 'ORGANIZER_DATA_UNAVAILABLE', 'Organizer data is not configured'); return }
    const organizerId = authentication(res)!.user.id
    const transition = options.organizerDecisionTransition
    let purchase
    try { purchase = await transactions.decisionState(organizerId, transactionId.data) }
    catch { fail(res, 503, 'ORGANIZER_DATA_UNAVAILABLE', 'Organizer data is temporarily unavailable'); return }
    if (!purchase) { fail(res, 404, 'TRANSACTION_NOT_FOUND', 'Transaction not found'); return }
    if (decisionAvailability(purchase, now(), transition) === 'CLOSED') {
      fail(res, 409, 'DECISION_CLOSED', 'This purchase is no longer open for a decision'); return
    }
    if (!transition) { fail(res, 503, 'DECISION_UNAVAILABLE', 'The purchase transition is not connected'); return }
    try {
      // The shared engine must repeat the guards atomically. The earlier read is advisory.
      const result = await transition({ organizerId, transactionId: transactionId.data, decision: input.data.decision })
      if (result === 'NOT_FOUND') { fail(res, 404, 'TRANSACTION_NOT_FOUND', 'Transaction not found'); return }
      if (result === 'CLOSED') { fail(res, 409, 'DECISION_CLOSED', 'This purchase is no longer open for a decision'); return }
      if (result !== 'APPLIED') { fail(res, 503, 'DECISION_UNCERTAIN', 'Reload the purchase before trying again'); return }
      res.json({ success: true, message: 'Decision recorded', data: {
        id: transactionId.data, status: input.data.decision === 'ACCEPT' ? 'DONE' : 'REJECTED',
      } })
    } catch { fail(res, 503, 'DECISION_UNCERTAIN', 'Reload the purchase before trying again') }
  })
  return router
}
