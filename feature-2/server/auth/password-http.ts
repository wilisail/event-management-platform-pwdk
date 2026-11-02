import { Router, json, type Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import { authentication, requireAuthentication, requireCsrf } from './authorization'
import { cookieNames } from './session-http'
import { PasswordChangeError, type PasswordChangeService } from './change-password'
import type { SessionService } from './sessions'

export function passwordRouter(options: { service?: PasswordChangeService; sessions?: SessionService;
  secureCookies: boolean; limit?: { limit: number; windowMs: number } }) {
  const router = Router()
  const fail = (res: Response, status: number, code: string, message: string) =>
    res.set('Cache-Control', 'no-store').status(status).json({ success: false, code, message })
  const attempts = rateLimit({ windowMs: options.limit?.windowMs ?? 15 * 60 * 1000, limit: options.limit?.limit ?? 5,
    keyGenerator: (_req, res) => authentication(res)!.user.id, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, res) => fail(res, 429, 'PASSWORD_RATE_LIMITED', 'Too many password attempts; try again later') })
  router.post('/password', requireAuthentication(options.sessions, options.secureCookies),
    requireCsrf(options.sessions, options.secureCookies), attempts, (req, res, next) => {
      if (!req.is('application/json')) { fail(res, 415, 'JSON_REQUIRED', 'Send password fields as JSON'); return }
      next()
    }, json({ limit: '2kb', strict: true }), async (req, res) => {
      if (!options.service) { fail(res, 503, 'PASSWORD_UNAVAILABLE', 'Password changes are not configured'); return }
      try {
        const actor = authentication(res)!
        await options.service.change({ userId: actor.user.id, sessionId: actor.sessionId }, req.body)
        const names = cookieNames(options.secureCookies)
        const cookie = { httpOnly: true, secure: options.secureCookies, sameSite: 'lax', path: '/' } as const
        res.clearCookie(names.access, cookie); res.clearCookie(names.refresh, cookie)
        res.set('Cache-Control', 'no-store').json({ success: true,
          message: 'Password changed; sign in again on each device', data: { signInRequired: true } })
      } catch (error) {
        if (error instanceof PasswordChangeError) {
          if (error.status === 503) res.set('Retry-After', '2')
          fail(res, error.status, error.code, error.message)
        } else fail(res, 503, 'PASSWORD_UNAVAILABLE', 'Password could not be changed; try again shortly')
      }
    })
  return router
}
