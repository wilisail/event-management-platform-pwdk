import { Router, json, raw, type Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { authentication, requireAuthentication, requireCsrf } from '../auth/authorization'
import type { SessionService } from '../auth/sessions'
import { MAX_PICTURE_BYTES, ProfileError, type ProfileService } from './service'

export function profileRouter(options: { service?: ProfileService; sessions?: SessionService; secureCookies: boolean }) {
  const router = Router(), signedIn = requireAuthentication(options.sessions, options.secureCookies)
  const csrf = requireCsrf(options.sessions, options.secureCookies)
  const fail = (res: Response, status: number, code: string, message: string) =>
    res.set('Cache-Control', 'no-store').status(status).json({ success: false, code, message })
  const handle = (res: Response, error: unknown) => error instanceof ProfileError
    ? fail(res, error.status, error.code, error.message)
    : fail(res, 503, 'PROFILE_UNAVAILABLE', 'Profile service is temporarily unavailable')
  const service = () => {
    if (!options.service) throw new ProfileError(503, 'PROFILE_UNAVAILABLE', 'Profiles are not configured')
    return options.service
  }
  const edits = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, keyGenerator: (_req, res) => authentication(res)!.user.id,
    standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, res) => fail(res, 429, 'PROFILE_RATE_LIMITED', 'Too many changes. Try again later') })
  const uploads = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, keyGenerator: (_req, res) => authentication(res)!.user.id,
    standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, res) => fail(res, 429, 'PROFILE_RATE_LIMITED', 'Too many uploads. Try again later') })
  router.patch('/me', signedIn, csrf, edits, (req, res, next) => {
    if (!req.is('application/json')) { fail(res, 415, 'JSON_REQUIRED', 'Send profile fields as JSON'); return }
    next()
  }, json({ limit: '2kb', strict: true }), async (req, res) => {
    try { res.json({ success: true, message: 'Profile updated', data: await service().updateName(authentication(res)!.user.id, req.body) }) }
    catch (error) { handle(res, error) }
  })
  router.post('/me/picture', signedIn, csrf, uploads, (req, res, next) => {
    if (!req.is(['image/jpeg', 'image/png', 'image/webp'])) {
      fail(res, 415, 'INVALID_PICTURE_TYPE', 'Use JPEG, PNG or WebP'); return
    }
    next()
  }, raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: MAX_PICTURE_BYTES, inflate: false }), async (req, res) => {
    try { res.json({ success: true, message: 'Photo updated', data: await service().upload(authentication(res)!.user.id,
      req.body, req.get('content-type')!.split(';')[0].trim().toLowerCase()) }) }
    catch (error) { handle(res, error) }
  })
  const sendPicture = (res: Response, bytes: Buffer) => res.set({ 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" }).type('image/webp').send(bytes)
  router.get('/me/picture', signedIn, async (_req, res) => {
    try { sendPicture(res, await service().picture(authentication(res)!.user.id)) }
    catch (error) { handle(res, error) }
  })
  router.get('/organizers/:organizerId', async (req, res) => {
    if (!z.uuid().safeParse(req.params.organizerId).success) { fail(res, 400, 'INVALID_ORGANIZER_ID', 'Use an organizer UUID'); return }
    try { res.set('Cache-Control', 'no-store').json({ success: true, message: 'Organizer profile', data: await service().publicOrganizer(req.params.organizerId) }) }
    catch (error) { handle(res, error) }
  })
  router.get('/organizers/:organizerId/picture', async (req, res) => {
    if (!z.uuid().safeParse(req.params.organizerId).success) { fail(res, 400, 'INVALID_ORGANIZER_ID', 'Use an organizer UUID'); return }
    try { sendPicture(res, await service().picture(req.params.organizerId, true)) }
    catch (error) { handle(res, error) }
  })
  return router
}
