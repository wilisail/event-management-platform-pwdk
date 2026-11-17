import type { RequestHandler, Response } from 'express'
import type { Role, UserView } from '../../contracts/types'
import { cookieNames, readCookie } from './session-http'
import { SessionError, type SessionService } from './sessions'

export interface Authentication {
  readonly user: Readonly<UserView>
  readonly sessionId: string
  readonly expiresAt: Date
}

// This context is set by server middleware, never read from request headers/body/query.
export const authentication = (res: Response): Authentication | undefined => res.locals.authentication

const fail = (res: Response, status: number, code: string, message: string) => {
  res.set('Cache-Control', 'no-store').status(status).json({ success: false, code, message })
}

export function requireAuthentication(service: SessionService | undefined, secureCookies: boolean): RequestHandler {
  const name = cookieNames(secureCookies).access
  return async (req, res, next) => {
    res.locals.authentication = undefined
    res.set('Cache-Control', 'no-store')
    if (!service) { fail(res, 503, 'AUTH_UNAVAILABLE', 'Login sessions are not configured'); return }
    try {
      const session = await service.readSession(readCookie(req, name))
      res.locals.authentication = Object.freeze({
        user: Object.freeze({ ...session.user }), sessionId: session.id, expiresAt: session.expiresAt,
      }) satisfies Authentication
      next()
    } catch (error) {
      if (error instanceof SessionError) fail(res, error.status, error.code, error.message)
      else fail(res, 503, 'AUTH_UNAVAILABLE', 'Authentication is temporarily unavailable')
    }
  }
}

export function requireRoles(...roles: Role[]): RequestHandler {
  if (!roles.length || roles.some(role => !['CUSTOMER', 'ORGANIZER'].includes(role))) {
    throw new Error('Specify at least one supported role')
  }
  return (_req, res, next) => {
    const actor = authentication(res)
    if (!actor) { fail(res, 401, 'SESSION_REQUIRED', 'Sign in to continue'); return }
    if (!roles.includes(actor.user.role)) { fail(res, 403, 'ROLE_FORBIDDEN', 'Your role cannot access this operation'); return }
    next()
  }
}

/** Add after authentication/roles to future mutations, including multipart uploads. */
export function requireCsrf(service: SessionService | undefined, secureCookies: boolean): RequestHandler {
  const name = cookieNames(secureCookies).refresh
  return async (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) { next(); return }
    const actor = authentication(res)
    if (!actor) { fail(res, 401, 'SESSION_REQUIRED', 'Sign in to continue'); return }
    if (!service) { fail(res, 503, 'AUTH_UNAVAILABLE', 'Login sessions are not configured'); return }
    if (req.get('x-temuevent-client') !== 'web' || req.get('sec-fetch-site') === 'cross-site') {
      fail(res, 403, 'AUTH_CLIENT_REQUIRED', 'Use the approved application request headers'); return
    }
    try {
      if (!await service.verifySessionCsrf(actor.sessionId, readCookie(req, name), req.get('x-csrf-token'))) {
        fail(res, 403, 'CSRF_INVALID', 'Refresh the application security token and try again'); return
      }
      next()
    } catch { fail(res, 503, 'AUTH_UNAVAILABLE', 'Authentication is temporarily unavailable') }
  }
}
