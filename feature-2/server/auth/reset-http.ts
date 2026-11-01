import { Router, json, type RequestHandler, type Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import { cookieNames } from './session-http'
import { PasswordResetError, RESET_REQUEST_MESSAGE, type PasswordResetService } from './password-reset'

export function resetRouter(options: { service?: PasswordResetService; secureCookies: boolean;
  defer?: (work: Promise<void>) => void;
  limit?: { limit: number; windowMs: number } }) {
  const router = Router()
  const fail = (res: Response, status: number, code: string, message: string) =>
    res.set('Cache-Control', 'no-store').status(status).json({ success: false, code, message })
  const client: RequestHandler = (req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' })
    if (!options.service) { fail(res, 503, 'RESET_UNAVAILABLE', 'Pemulihan akun belum tersedia. Coba lagi nanti.'); return }
    if (req.get('x-temuevent-client') !== 'web' || req.get('sec-fetch-site') === 'cross-site') {
      fail(res, 403, 'AUTH_CLIENT_REQUIRED', 'Gunakan aplikasi TemuEvent.'); return
    }
    if (!req.is('application/json')) { fail(res, 415, 'JSON_REQUIRED', 'Kirim data sebagai JSON.'); return }
    next()
  }
  const attempts = () => rateLimit({ windowMs: options.limit?.windowMs ?? 15 * 60 * 1000,
    limit: options.limit?.limit ?? 10, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, res) => fail(res, 429, 'RESET_RATE_LIMITED', 'Terlalu banyak percobaan. Coba lagi nanti.') })
  const handle = (res: Response, error: unknown) => {
    if (error instanceof PasswordResetError) {
      if (error.status === 503) res.set('Retry-After', '2')
      fail(res, error.status, error.code, error.message)
    } else fail(res, 503, 'RESET_UNAVAILABLE', 'Pemulihan belum dapat diselesaikan. Coba masuk dengan kata sandi baru atau minta tautan baru.')
  }
  router.post('/forgot-password', client, attempts(), json({ limit: '2kb', strict: true }), async (req, res) => {
    try {
      await options.service!.request(req.body)
      res.once('finish', () => { const work = options.service!.dispatchPending(); options.defer?.(work) })
      res.status(202).json({ success: true, message: RESET_REQUEST_MESSAGE, data: null })
    } catch (error) { handle(res, error) }
  })
  router.post('/reset-password', client, attempts(), json({ limit: '2kb', strict: true }), async (req, res) => {
    try {
      await options.service!.reset(req.body)
      const names = cookieNames(options.secureCookies)
      const cookie = { httpOnly: true, secure: options.secureCookies, sameSite: 'lax', path: '/' } as const
      res.clearCookie(names.access, cookie); res.clearCookie(names.refresh, cookie)
      res.json({ success: true, message: 'Kata sandi dipulihkan. Silakan masuk kembali.', data: { signInRequired: true } })
    } catch (error) { handle(res, error) }
  })
  return router
}
