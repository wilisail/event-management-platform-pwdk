import { Router, json, type Request, type Response, type CookieOptions } from 'express'
import { rateLimit } from 'express-rate-limit'
import { SessionError, type SessionService, type SessionCredentials } from './sessions'
import type { UserView } from '../../contracts/types'

export const cookieNames = (secure: boolean) => ({
  access: (secure ? '__Host-' : '') + 'temuevent_access',
  refresh: (secure ? '__Host-' : '') + 'temuevent_refresh',
})

export function readCookie(req: Request, name: string): string | null {
  const values = (req.headers.cookie ?? '').split(';').flatMap(part => {
    const index = part.indexOf('=')
    return index >= 0 && part.slice(0, index).trim() === name ? [part.slice(index + 1).trim()] : []
  })
  // Tokens use URL-safe characters; no decoding is required. Reject ambiguous duplicates.
  return values.length === 1 ? values[0] : null
}

const publicUser = (user: UserView): UserView => ({
  id: user.id, name: user.name, email: user.email, role: user.role,
  referralCode: user.referralCode, profilePictureUrl: user.profilePictureUrl,
})

export function sessionRouter(options: {
  service?: SessionService
  secureCookies: boolean
  now: () => Date
  loginLimit?: { limit: number; windowMs: number }
}) {
  const router = Router()
  const names = cookieNames(options.secureCookies)
  const cookie: CookieOptions = { httpOnly: true, secure: options.secureCookies, sameSite: 'lax', path: '/' }
  const fail = (res: Response, status: number, code: string, message: string) => {
    res.status(status).json({ success: false, code, message })
  }
  const clear = (res: Response) => {
    res.clearCookie(names.access, cookie)
    res.clearCookie(names.refresh, cookie)
  }
  const sendCredentials = (res: Response, value: SessionCredentials, message: string) => {
    const at = options.now().getTime()
    res.cookie(names.access, value.accessToken, { ...cookie, maxAge: Math.max(0, value.accessExpiresAt.getTime() - at) })
    res.cookie(names.refresh, value.refreshToken, { ...cookie, maxAge: Math.max(0, value.sessionExpiresAt.getTime() - at) })
    res.json({ success: true, message, data: {
      user: publicUser(value.user), csrfToken: value.csrfToken,
      accessExpiresAt: value.accessExpiresAt.toISOString(), sessionExpiresAt: value.sessionExpiresAt.toISOString(),
    } })
  }
  router.use((_req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' })
    next()
  })
  router.use((req, res, next) => {
    if (!options.service) { fail(res, 503, 'AUTH_UNAVAILABLE', 'Login sessions are not configured'); return }
    if (req.method === 'POST') {
      // Login CSRF is also blocked: a cross-site HTML form cannot supply this header.
      if (req.get('x-temuevent-client') !== 'web' || req.get('sec-fetch-site') === 'cross-site') {
        fail(res, 403, 'AUTH_CLIENT_REQUIRED', 'Use the approved application request headers'); return
      }
      if (!req.is('application/json')) { fail(res, 415, 'JSON_REQUIRED', 'Send authentication requests as JSON'); return }
    }
    next()
  })
  const loginLimiter = rateLimit({
    windowMs: options.loginLimit?.windowMs ?? 15 * 60 * 1000,
    limit: options.loginLimit?.limit ?? 10, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, res) => fail(res, 429, 'LOGIN_RATE_LIMITED', 'Too many sign-in attempts. Try again later'),
  })
  const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, res) => fail(res, 429, 'REFRESH_RATE_LIMITED', 'Too many refresh attempts. Try again later'),
  })
  const handle = (res: Response, error: unknown, clearOnUnauthorized = false) => {
    if (error instanceof SessionError) {
      if (clearOnUnauthorized && error.status === 401) clear(res)
      if (error.status === 503) res.set('Retry-After', '2')
      fail(res, error.status, error.code, error.message)
    } else fail(res, 503, 'AUTH_UNAVAILABLE', 'Authentication is temporarily unavailable')
  }
  router.post('/login', loginLimiter, json({ limit: '8kb', strict: true }), async (req, res) => {
    try { sendCredentials(res, await options.service!.login(req.body), 'Signed in') }
    catch (error) { handle(res, error) }
  })
  router.get('/csrf', (req, res) => {
    try { res.json({ success: true, message: 'CSRF token ready', data: {
      csrfToken: options.service!.csrfToken(readCookie(req, names.refresh)),
    } }) }
    catch (error) { handle(res, error) }
  })
  const csrf = (req: Request, res: Response): string | null | false => {
    const refresh = readCookie(req, names.refresh)
    if (!refresh) { fail(res, 401, 'SESSION_REQUIRED', 'Sign in to continue'); return false }
    if (!options.service!.verifyCsrf(refresh, req.get('x-csrf-token'))) {
      fail(res, 403, 'CSRF_INVALID', 'Refresh the application security token and try again'); return false
    }
    return refresh
  }
  router.post('/refresh', refreshLimiter, json({ limit: '1kb', strict: true }), async (req, res) => {
    const refresh = csrf(req, res)
    if (refresh === false) return
    try { sendCredentials(res, await options.service!.refresh(refresh), 'Session refreshed') }
    catch (error) { handle(res, error, true) }
  })
  router.post('/logout', json({ limit: '1kb', strict: true }), async (req, res) => {
    const refresh = readCookie(req, names.refresh)
    if (refresh && csrf(req, res) === false) return
    try {
      await options.service!.logout(refresh)
      clear(res)
      res.json({ success: true, message: 'Signed out', data: null })
    } catch (error) { handle(res, error) }
  })
  // Session inspection supports this batch's tests; reusable role middleware follows separately.
  router.get('/session', async (req, res) => {
    try {
      const session = await options.service!.readSession(readCookie(req, names.access))
      res.json({ success: true, message: 'Active session', data: {
        user: publicUser(session.user), sessionExpiresAt: session.expiresAt.toISOString(),
      } })
    } catch (error) { handle(res, error) }
  })
  return router
}
