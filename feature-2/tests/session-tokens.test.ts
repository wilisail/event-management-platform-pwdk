import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { SignJWT, decodeJwt } from 'jose'
import { createSessionTokens, ACCESS_SECONDS, hashRefreshToken, validRefreshToken } from '../server/auth/session-tokens'
import { testSecret } from './helpers/sessions'

test('JWT access credentials verify signature, intended audience and strict expiry', async () => {
  const tokens = createSessionTokens(testSecret)
  const at = new Date('2026-10-31T07:00:00.000Z')
  const end = new Date(at.getTime() + ACCESS_SECONDS * 1000)
  const userId = randomUUID(), sessionId = randomUUID()
  const jwt = await tokens.signAccess(userId, sessionId, at, end)
  assert.deepEqual(await tokens.verifyAccess(jwt, at), { userId, sessionId })
  assert.equal(await tokens.verifyAccess(jwt, end), null)
  assert.equal(await tokens.verifyAccess(jwt, new Date(at.getTime() - 1000)), null)
  assert.equal(await createSessionTokens('cd'.repeat(32)).verifyAccess(jwt, at), null)
  const parts = jwt.split('.')
  parts[1] = Buffer.from(JSON.stringify({ ...decodeJwt(jwt), sub: randomUUID() })).toString('base64url')
  assert.equal(await tokens.verifyAccess(parts.join('.'), at), null)
  assert.equal('role' in decodeJwt(jwt), false)
  assert.equal('email' in decodeJwt(jwt), false)
  const otherAudience = await new SignJWT({ sid: sessionId }).setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId).setIssuer('temuevent-api').setAudience('another-app').setJti(randomUUID())
    .setIssuedAt(at.getTime() / 1000).setExpirationTime(end.getTime() / 1000).sign(Buffer.from(testSecret, 'hex'))
  assert.equal(await tokens.verifyAccess(otherAudience, at), null)
})

test('opaque refresh secrets use digests and CSRF headers are bound to each secret', () => {
  const tokens = createSessionTokens(testSecret)
  const first = tokens.newRefreshToken(), second = tokens.newRefreshToken()
  assert(validRefreshToken(first))
  assert.notEqual(first, second)
  assert.match(hashRefreshToken(first), /^[a-f0-9]{64}$/)
  assert.equal(hashRefreshToken(first), hashRefreshToken(first))
  assert.notEqual(hashRefreshToken(first), hashRefreshToken(second))
  const csrf = tokens.csrfToken(first)
  assert(tokens.verifyCsrf(first, csrf))
  assert.equal(tokens.verifyCsrf(second, csrf), false)
  assert.equal(tokens.verifyCsrf(first, 'x'.repeat(100000)), false)
  assert.equal(tokens.verifyCsrf(first, undefined), false)
  assert.equal(validRefreshToken('bad-token'), false)
  assert.throws(() => createSessionTokens('short'))
})
