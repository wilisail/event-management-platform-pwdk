import assert from 'node:assert/strict'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { Prisma } from '../generated/prisma/client'
import { databaseClient, disconnectDatabase } from '../src/client'

const db = databaseClient()
const rollback = new Error('ROLLBACK_AUTH_FOUNDATION_CHECK')
const asOf = new Date()
const earlier = new Date(asOf.getTime() - 1000)
const later = new Date(asOf.getTime() + 3600000)
const testedSessions: string[] = []
const testedTokens: string[] = []
let currentCheck = 'connection'

function sessionData(userId: string) {
  const id = randomUUID()
  testedSessions.push(id)
  return { id, userId, createdAt: earlier, expiresAt: later }
}

function tokenData(sessionId: string) {
  const id = randomUUID()
  testedTokens.push(id)
  // A real refresh secret is high-entropy random data. Only its hash reaches SQL.
  const tokenHash = createHash('sha256').update(randomBytes(32)).digest('hex')
  return { id, sessionId, tokenHash, createdAt: earlier, expiresAt: later }
}

async function rolledBack(work: (tx: Prisma.TransactionClient) => Promise<void>) {
  await assert.rejects(db.$transaction(async tx => {
    await work(tx)
    throw rollback
  }, { timeout: 15000 }), error => error === rollback)
}

function hasCode(error: unknown, expected: string): boolean {
  const seen = new Set<object>()
  function visit(value: unknown): boolean {
    if (value === expected) return true
    if (!value || typeof value !== 'object' || seen.has(value)) return false
    seen.add(value)
    return Object.getOwnPropertyNames(value).some(key => visit((value as Record<string, unknown>)[key]))
  }
  return visit(error)
}

async function rejected(
  label: string,
  work: (tx: Prisma.TransactionClient) => Promise<unknown>,
  code: string,
) {
  currentCheck = label
  await assert.rejects(db.$transaction(work, { timeout: 15000 }), error => hasCode(error, code))
}

async function main() {
  const customer = await db.user.findUniqueOrThrow({
    where: { email: 'ayu@example.test' }, select: { id: true, role: true },
  })
  const organizer = await db.user.findUniqueOrThrow({
    where: { email: 'organizer@example.test' }, select: { id: true, role: true },
  })
  const [capabilities] = await db.$queryRaw<Array<{
    databaseRole: string; canCreateSchemaObjects: boolean; canDeleteSessions: boolean;
    canReadSessions: boolean; canReadRefreshTokens: boolean; canReadMigrationHistory: boolean;
  }>>`SELECT current_user::text AS "databaseRole",
    has_schema_privilege(current_user, 'temuevent', 'CREATE') AS "canCreateSchemaObjects",
    has_table_privilege(current_user, 'temuevent.auth_sessions', 'DELETE') AS "canDeleteSessions",
    has_table_privilege(current_user, 'temuevent.auth_sessions', 'SELECT') AS "canReadSessions",
    has_table_privilege(current_user, 'temuevent.auth_refresh_tokens', 'SELECT') AS "canReadRefreshTokens",
    has_table_privilege(current_user, 'temuevent._prisma_migrations', 'SELECT') AS "canReadMigrationHistory"`
  assert.equal(capabilities.databaseRole, 'temuevent_app')
  assert.equal(capabilities.canCreateSchemaObjects, false)
  assert.equal(capabilities.canDeleteSessions, false)
  assert.equal(capabilities.canReadSessions, true)
  assert.equal(capabilities.canReadRefreshTokens, true)
  assert.equal(capabilities.canReadMigrationHistory, false)

  currentCheck = 'relationships, rotation data and session revocation'
  await rolledBack(async tx => {
    const laptop = await tx.authSession.create({ data: sessionData(customer.id) })
    const phone = await tx.authSession.create({ data: sessionData(customer.id) })
    await tx.authSession.create({ data: sessionData(organizer.id) })
    const oldToken = await tx.authRefreshToken.create({ data: tokenData(laptop.id) })
    const joined = await tx.authRefreshToken.findUniqueOrThrow({
      where: { id: oldToken.id },
      include: { session: { include: { user: { select: { id: true, role: true } } } } },
    })
    assert.equal(joined.session.user.id, customer.id)
    assert.equal(joined.session.user.role, 'CUSTOMER')
    assert.equal(await tx.authSession.count({ where: { userId: customer.id, id: { in: [laptop.id, phone.id] } } }), 2)

    const firstUse = await tx.authRefreshToken.updateMany({
      where: { id: oldToken.id, consumedAt: null, expiresAt: { gt: asOf } },
      data: { consumedAt: asOf },
    })
    assert.equal(firstUse.count, 1)
    const replacement = await tx.authRefreshToken.create({ data: tokenData(laptop.id) })
    const repeatedUse = await tx.authRefreshToken.updateMany({
      where: { id: oldToken.id, consumedAt: null, expiresAt: { gt: asOf } },
      data: { consumedAt: asOf },
    })
    assert.equal(repeatedUse.count, 0)
    assert.notEqual(oldToken.tokenHash, replacement.tokenHash)

    await tx.authSession.update({ where: { id: laptop.id }, data: { revokedAt: asOf } })
    const allowed = { revokedAt: null, expiresAt: { gt: asOf } }
    assert.equal(await tx.authSession.count({ where: { id: laptop.id, ...allowed } }), 0)
    assert.equal(await tx.authSession.count({ where: { id: phone.id, ...allowed } }), 1)
    assert.equal(await tx.authRefreshToken.count({ where: {
      id: replacement.id, consumedAt: null, expiresAt: { gt: asOf }, session: { is: allowed },
    } }), 0)

    const expired = await tx.authSession.create({ data: {
      ...sessionData(customer.id), createdAt: new Date(asOf.getTime() - 7200000),
      expiresAt: new Date(asOf.getTime() - 3600000),
    } })
    const stillUnexpired = await tx.authRefreshToken.create({ data: tokenData(expired.id) })
    assert.equal(await tx.authRefreshToken.count({ where: {
      id: stillUnexpired.id, consumedAt: null, expiresAt: { gt: asOf }, session: { is: allowed },
    } }), 0)
  })

  await rejected('session requires an existing user', tx =>
    tx.authSession.create({ data: sessionData(randomUUID()) }), 'P2003')
  await rejected('refresh token requires an existing session', tx =>
    tx.authRefreshToken.create({ data: tokenData(randomUUID()) }), 'P2003')
  await rejected('refresh hash is unique', async tx => {
    const session = await tx.authSession.create({ data: sessionData(customer.id) })
    const first = tokenData(session.id)
    await tx.authRefreshToken.create({ data: first })
    return tx.authRefreshToken.create({ data: { ...tokenData(session.id), tokenHash: first.tokenHash } })
  }, 'P2002')
  await rejected('session expiry follows creation', tx =>
    tx.authSession.create({ data: { ...sessionData(customer.id), expiresAt: earlier } }), '23514')
  await rejected('session revocation follows creation', tx =>
    tx.authSession.create({ data: {
      ...sessionData(customer.id), revokedAt: new Date(earlier.getTime() - 1000),
    } }), '23514')
  await rejected('refresh hash has the required format', async tx => {
    const session = await tx.authSession.create({ data: sessionData(customer.id) })
    return tx.authRefreshToken.create({ data: { ...tokenData(session.id), tokenHash: 'invalid-hash' } })
  }, '23514')
  await rejected('refresh expiry follows creation', async tx => {
    const session = await tx.authSession.create({ data: sessionData(customer.id) })
    return tx.authRefreshToken.create({ data: { ...tokenData(session.id), expiresAt: earlier } })
  }, '23514')
  await rejected('refresh consumption follows creation', async tx => {
    const session = await tx.authSession.create({ data: sessionData(customer.id) })
    return tx.authRefreshToken.create({ data: {
      ...tokenData(session.id), consumedAt: new Date(earlier.getTime() - 1000),
    } })
  }, '23514')
  currentCheck = 'rollback cleanup'
  assert.equal(await db.authSession.count({ where: { id: { in: testedSessions } } }), 0)
  assert.equal(await db.authRefreshToken.count({ where: { id: { in: testedTokens } } }), 0)
  console.log(JSON.stringify({ passed: [
    'Existing backend role can use auth tables without DDL or migration-history access',
    'One user has separate sessions; each refresh hash joins back to its user',
    'Conditional refresh consumption succeeds once; replacement has a different hash',
    'Revoking one session preserves another; expired/revoked sessions fail active queries',
    'Foreign keys and unique refresh hashes reject invalid relationships/reuse',
    'Database checks reject invalid dates and malformed token hashes',
    'All temporary test records are rolled back',
  ], scope: 'Database foundation only; no HTTP login, cookies or JWT verification implemented here' }, null, 2))
}

main().catch(() => {
  console.error('Auth database verification failed at: ' + currentCheck)
  process.exitCode = 1
}).finally(disconnectDatabase)
