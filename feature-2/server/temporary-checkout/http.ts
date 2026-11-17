import { Router, json, raw, type Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { authentication, requireAuthentication, requireCsrf, requireRoles } from '../auth/authorization'
import type { SessionService } from '../auth/sessions'
import { RewardOperationError } from '../rewards/operations'
import { CheckoutError, MAX_CHECKOUT_PROOF_BYTES, type CheckoutService } from './service'

export function temporaryCheckoutRouter(options: { service?: CheckoutService; sessions?: SessionService; secureCookies: boolean }) {
  const router = Router(), signedIn = requireAuthentication(options.sessions, options.secureCookies)
  const customer = requireRoles('CUSTOMER'), csrf = requireCsrf(options.sessions, options.secureCookies)
  const fail = (res: Response, status: number, code: string, message: string) =>
    res.status(status).json({ success: false, code, message })
  const service = () => {
    if (!options.service) throw new CheckoutError(503, 'CHECKOUT_UNAVAILABLE', 'Layanan pesanan belum tersedia.')
    return options.service
  }
  const handle = (res: Response, error: unknown) => error instanceof CheckoutError || error instanceof RewardOperationError
    ? fail(res, error.status, error.code, error.message)
    : fail(res, 503, 'CHECKOUT_UNCERTAIN', 'Periksa pesanan sebelum mencoba kembali.')
  const limiter = (limit: number) => rateLimit({ windowMs: 15 * 60 * 1000, limit,
    keyGenerator: (_req, res) => authentication(res)!.user.id, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, res) => fail(res, 429, 'CHECKOUT_RATE_LIMITED', 'Terlalu banyak percobaan. Coba kembali nanti.') })
  router.use(['/me/purchases', '/checkout/purchases'], (_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next() })
  const validId = (id: unknown, query: object) => {
    const result = z.uuid().safeParse(id)
    if (!result.success || Object.keys(query).length) throw new CheckoutError(400, 'INVALID_PURCHASE_ID', 'Gunakan ID pesanan yang valid tanpa parameter tambahan.')
    return result.data.toLowerCase()
  }
  router.get('/me/purchases', signedIn, customer, async (req, res) => {
    try {
      if (Object.keys(req.query).length) throw new CheckoutError(400, 'INVALID_QUERY', 'Parameter tidak didukung.')
      res.json({ success: true, data: await service().list(authentication(res)!.user.id) })
    } catch (error) { handle(res, error) }
  })
  router.get('/me/purchases/:id', signedIn, customer, async (req, res) => {
    try { res.json({ success: true, data: await service().detail(authentication(res)!.user.id, validId(req.params.id, req.query)) }) }
    catch (error) { handle(res, error) }
  })
  router.post('/checkout/purchases', signedIn, customer, csrf, limiter(30), (req, res, next) => {
    if (!req.is('application/json')) { fail(res, 415, 'JSON_REQUIRED', 'Kirim pilihan tiket sebagai JSON.'); return }
    next()
  }, json({ limit: '8kb', strict: true }), async (req, res) => {
    try {
      if (Object.keys(req.query).length) throw new CheckoutError(400, 'INVALID_QUERY', 'Parameter tidak didukung.')
      res.status(201).json({ success: true, data: await service().create(authentication(res)!.user.id, req.body) })
    } catch (error) { handle(res, error) }
  })
  router.post('/me/purchases/:id/proof', signedIn, customer, csrf, limiter(10), (req, res, next) => {
    if (!req.is(['image/png', 'image/jpeg'])) { fail(res, 415, 'INVALID_PROOF_TYPE', 'Gunakan PNG atau JPEG.'); return }
    next()
  }, raw({ type: ['image/png', 'image/jpeg'], limit: MAX_CHECKOUT_PROOF_BYTES, inflate: false }), async (req, res) => {
    try { res.json({ success: true, data: await service().upload(authentication(res)!.user.id,
      validId(req.params.id, req.query), req.body, req.get('content-type')!) }) }
    catch (error) { handle(res, error) }
  })
  router.get('/me/purchases/:id/proof', signedIn, customer, async (req, res) => {
    try {
      const file = await service().proof(authentication(res)!.user.id, validId(req.params.id, req.query))
      res.set({ 'Content-Type': file.contentType, 'Content-Disposition': `inline; filename="${file.filename}"`,
        'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox; frame-ancestors 'none'", 'Referrer-Policy': 'no-referrer' }).send(file.bytes)
    } catch (error) { handle(res, error) }
  })
  return router
}
