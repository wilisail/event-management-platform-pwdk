import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type Prisma } from '../generated/prisma/client'
import { createPasswordChangeService } from '../server/auth/change-password'
import { prismaPasswordRepository } from '../server/auth/password-repository'
import { hashPassword, verifyPassword } from '../server/auth/passwords'
import { prismaSessionRepository } from '../server/auth/session-repository'
import { createSessionService } from '../server/auth/sessions'
import { createSessionTokens, hashRefreshToken } from '../server/auth/session-tokens'

// Independent connections require committed fixtures. This guard prevents use of the shared project.
const value = process.env.PASSWORD_RACE_DATABASE_URL
if (process.env.PASSWORD_RACE_TEST_ALLOW_LOCAL !== 'true' || !value) throw new Error('An explicitly enabled isolated password database is required')
const url = new URL(value)
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.pathname !== '/temuevent_password_test' || url.username !== 'temuevent_app') {
  throw new Error('Password race checks only run on the dedicated loopback temuevent_password_test database')
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 5, ssl: false }) })
const txOptions = { isolationLevel: 'ReadCommitted' as const, timeout: 30000, maxWait: 10000 }
type Transaction = <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>
const transaction: Transaction = work => db.$transaction(work, txOptions)
const tokens = createSessionTokens(randomBytes(32).toString('hex'))
const sessionService = (tx = transaction) => createSessionService({ repository: prismaSessionRepository(db, tx), tokens })
const passwordService = (tx = transaction, now?: () => Date) => createPasswordChangeService({ repository: prismaPasswordRepository(db, tx, now) })
let stage = 'isolated database guard', passed = 0
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
async function bounded<T>(promise: Promise<T>) {
  let timer: ReturnType<typeof setTimeout>
  try { return await Promise.race([promise, new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('Race barrier timed out')), 10000)
  })]) } finally { clearTimeout(timer!) }
}
function holdingTransaction() {
  const entered = deferred<number>(), release = deferred<void>()
  const run: Transaction = work => db.$transaction(async tx => {
    const pid = (await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`)[0].pid
    const result = await work(tx)
    entered.resolve(pid); await bounded(release.promise)
    return result
  }, txOptions)
  return { run, entered, release }
}
function waitingTransaction() {
  const entered = deferred<number>()
  const run: Transaction = work => db.$transaction(async tx => {
    entered.resolve((await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`)[0].pid)
    return work(tx)
  }, txOptions)
  return { run, entered }
}
async function assertBlocked(holder: number, waiter: number) {
  assert.notEqual(holder, waiter, 'Contenders must use independent PostgreSQL sessions')
  for (let attempt = 0; attempt < 100; attempt++) {
    const rows = await db.$queryRaw<{ wait: string | null }[]>`SELECT wait_event_type AS wait FROM pg_stat_activity WHERE pid = ${waiter}`
    if (rows[0]?.wait === 'Lock') return
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  assert.fail('Expected a real PostgreSQL lock wait')
}
async function fixture() {
  const password = randomBytes(24).toString('hex'), next = randomBytes(24).toString('hex')
  const user = await db.user.create({ data: { email: 'password-race-' + randomUUID() + '@example.test', name: 'Race QA',
    passwordHash: await hashPassword(password), referralCode: randomBytes(6).toString('hex').toUpperCase() } })
  const credentials = await sessionService().login({ email: user.email, password })
  const session = await sessionService().readSession(credentials.accessToken)
  return { user, password, next, credentials, actor: { userId: user.id, sessionId: session.id },
    fields: { currentPassword: password, newPassword: next } }
}
async function assertRevoked(f: Awaited<ReturnType<typeof fixture>>) {
  assert.equal(await db.authSession.count({ where: { userId: f.user.id, revokedAt: null } }), 0)
  await assert.rejects(sessionService().readSession(f.credentials.accessToken), { status: 401 })
}
async function main() {
  const identity = await db.$queryRaw<{ database: string; role: string }[]>`SELECT current_database() AS database, current_user AS role`
  assert.deepEqual(identity, [{ database: 'temuevent_password_test', role: 'temuevent_app' }])

  stage = 'password change commits before an already-verified old-password login'
  {
    const f = await fixture(), hold = holdingTransaction(), wait = waitingTransaction()
    const changed = passwordService(hold.run).change(f.actor, f.fields)
    // Observe both results immediately so an unexpected rejection cannot become unhandled.
    const changedResult = Promise.allSettled([changed])
    let loginResult: Promise<PromiseSettledResult<unknown>[]> | undefined
    try {
      const holder = await bounded(hold.entered.promise)
      loginResult = Promise.allSettled([sessionService(wait.run).login({ email: f.user.email, password: f.password })])
      await assertBlocked(holder, await bounded(wait.entered.promise))
    } finally { hold.release.resolve() }
    assert.equal((await changedResult)[0].status, 'fulfilled')
    const login = (await loginResult!)[0]
    assert(login.status === 'rejected' && login.reason.code === 'INVALID_CREDENTIALS')
    await assertRevoked(f); passed++
  }

  stage = 'old-password login commits first and is included in password revocation'
  {
    const f = await fixture(), hold = holdingTransaction(), wait = waitingTransaction()
    const loggingIn = sessionService(hold.run).login({ email: f.user.email, password: f.password })
    const loginResult = Promise.allSettled([loggingIn])
    let changeResult: Promise<PromiseSettledResult<void>[]> | undefined
    try {
      const holder = await bounded(hold.entered.promise)
      changeResult = Promise.allSettled([passwordService(wait.run).change(f.actor, f.fields)])
      await assertBlocked(holder, await bounded(wait.entered.promise))
    } finally { hold.release.resolve() }
    assert.equal((await changeResult!)[0].status, 'fulfilled')
    const login = (await loginResult)[0]; assert.equal(login.status, 'fulfilled')
    if (login.status === 'fulfilled') await assert.rejects(sessionService().readSession(login.value.accessToken), { status: 401 })
    await assertRevoked(f); passed++
  }

  stage = 'two competing password changes have exactly one winner'
  {
    const f = await fixture(), ready = deferred<void>(), pids = new Set<number>()
    let count = 0
    const concurrent: Transaction = work => db.$transaction(async tx => {
      pids.add((await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`)[0].pid)
      if (++count === 2) ready.resolve()
      await bounded(ready.promise)
      return work(tx)
    }, txOptions)
    const candidates = [f.next, f.next + ' second']
    const results = await Promise.allSettled(candidates.map(newPassword => passwordService(concurrent).change(f.actor, { ...f.fields, newPassword })))
    assert.equal(pids.size, 2); assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
    assert.equal(results.filter(result => result.status === 'rejected').length, 1)
    const stored = await db.user.findUniqueOrThrow({ where: { id: f.user.id } })
    const winner = results.findIndex(result => result.status === 'fulfilled')
    assert.equal(await verifyPassword(candidates[winner], stored.passwordHash!), true)
    assert.equal(await verifyPassword(f.password, stored.passwordHash!), false)
    await assertRevoked(f); passed++
  }

  stage = 'refresh finishing during a password change cannot leave a usable session'
  {
    const f = await fixture(), hold = holdingTransaction(), wait = waitingTransaction()
    const refreshing = sessionService(hold.run).refresh(f.credentials.refreshToken)
    const refreshResult = Promise.allSettled([refreshing])
    let changeResult: Promise<PromiseSettledResult<void>[]> | undefined
    try {
      const holder = await bounded(hold.entered.promise)
      changeResult = Promise.allSettled([passwordService(wait.run).change(f.actor, f.fields)])
      await assertBlocked(holder, await bounded(wait.entered.promise))
    } finally { hold.release.resolve() }
    assert.equal((await changeResult!)[0].status, 'fulfilled')
    const refresh = (await refreshResult)[0]; assert.equal(refresh.status, 'fulfilled')
    if (refresh.status === 'fulfilled') {
      await assert.rejects(sessionService().readSession(refresh.value.accessToken), { status: 401 })
      await assert.rejects(sessionService().refresh(refresh.value.refreshToken), { status: 401 })
    }
    await assertRevoked(f); passed++
  }

  stage = 'logout winning its session lock prevents a queued password change'
  {
    const f = await fixture(), hold = holdingTransaction(), wait = waitingTransaction()
    const loggingOut = prismaSessionRepository(db, hold.run).revokeByRefreshHash(hashRefreshToken(f.credentials.refreshToken), new Date())
    const logoutResult = Promise.allSettled([loggingOut])
    let changeResult: Promise<PromiseSettledResult<void>[]> | undefined
    try {
      const holder = await bounded(hold.entered.promise)
      changeResult = Promise.allSettled([passwordService(wait.run).change(f.actor, f.fields)])
      await assertBlocked(holder, await bounded(wait.entered.promise))
    } finally { hold.release.resolve() }
    assert.equal((await logoutResult)[0].status, 'fulfilled')
    const change = (await changeResult!)[0]
    assert(change.status === 'rejected' && change.reason.code === 'SESSION_REQUIRED')
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: f.user.id } })).passwordHash, f.user.passwordHash)
    passed++
  }

  stage = 'expiry while waiting for the user lock prevents a queued password change'
  {
    const f = await fixture(), hold = holdingTransaction(), wait = waitingTransaction()
    const locking = hold.run(async tx => { await tx.$queryRaw`SELECT id FROM temuevent.users WHERE id = ${f.user.id}::uuid FOR UPDATE` })
    const lockingResult = Promise.allSettled([locking])
    let at = new Date(), changeResult: Promise<PromiseSettledResult<void>[]> | undefined
    try {
      const holder = await bounded(hold.entered.promise)
      changeResult = Promise.allSettled([passwordService(wait.run, () => at).change(f.actor, f.fields)])
      await assertBlocked(holder, await bounded(wait.entered.promise))
      at = new Date(f.credentials.sessionExpiresAt.getTime() + 1)
    } finally { hold.release.resolve() }
    assert.equal((await lockingResult)[0].status, 'fulfilled')
    const change = (await changeResult!)[0]
    assert(change.status === 'rejected' && change.reason.code === 'SESSION_REQUIRED')
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: f.user.id } })).passwordHash, f.user.passwordHash)
    passed++
  }
  console.log('PASSWORD_RACES_OK: ' + passed + ' scenarios on independent PostgreSQL connections; real lock waits observed, stale login fenced, all new/rotated sessions revoked, one password-change winner, logout and expiry respected. Only the isolated loopback database was used.')
}
main().catch(error => {
  console.error('Password race verification failed at: ' + stage)
  console.error(JSON.stringify({ name: error?.name, code: error?.code }))
  process.exitCode = 1
}).finally(() => db.$disconnect())
