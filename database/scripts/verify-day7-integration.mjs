import assert from 'node:assert/strict'
import { once } from 'node:events'
import { readFile, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const require = createRequire(import.meta.url)
const { PrismaClient: EventClient } = require('../../generated/prisma/client.ts')
const { PrismaClient: AccountClient } = require('../../feature-2/generated/prisma/client.ts')
const { createApp: createEvents } = require('../../server/app.ts')
const { createEventWriter } = require('../../server/database.ts')
const { createApp: createAccounts } = require('../../feature-2/server/app.ts')
const { prismaOrganizerReadRepository } = require('../../feature-2/server/organizer/read-repository.ts')
const { sessionFixture, testAccount, loginFields } = require('../../feature-2/tests/helpers/sessions.ts')
const { createAuthClient } = require('../../feature-2/lib/auth-client.ts')

// The F1 development history creates its own copy of the account/reward tables.
// Replay it separately; those creation statements must never enter the shared replay below.
const developer = await PGlite.create()
try {
  await developer.exec('CREATE SCHEMA temuevent; SET search_path TO temuevent, public;')
  const root = new URL('../../prisma/rizky-migrations/', import.meta.url)
  const names = (await readdir(root, { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name).sort()
  for (const name of names) await developer.exec(await readFile(new URL(name + '/migration.sql', root), 'utf8'))
  const tables = await developer.query("SELECT table_name FROM information_schema.tables WHERE table_schema='temuevent'")
  for (const name of ['users', 'events', 'vouchers', 'auth_sessions', 'attendance', 'organizer_decision_emails']) {
    assert(tables.rows.some(row => row.table_name === name), 'Missing F1 developer table: ' + name)
  }
  console.log(`DAY7_F1_DEV_HISTORY_OK: ${names.length} developer migrations replayed separately; no shared database connection used`)
} finally { await developer.close() }

// Every record and connection lives in this disposable database. No .env/project URL is read.
const pg = await PGlite.create()
let socket, eventDb, accountDb, server, pool
try {
  await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;')
  const root = new URL('../prisma/migrations/', import.meta.url)
  const names = (await readdir(root, { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name).sort()
  for (const name of names) await pg.exec(await readFile(new URL(name + '/migration.sql', root), 'utf8'))
  socket = new PGLiteSocketServer({ db: pg, host: '127.0.0.1', port: 0 })
  await socket.start()
  // The disposable socket server supports one physical connection. Both real clients share it.
  pool = new Pool({ connectionString: `postgresql://postgres@${socket.getServerConn()}/postgres`, max: 1, connectionTimeoutMillis: 5000, ssl: false })
  const adapter = () => new PrismaPg(pool, { disposeExternalPool: false })
  eventDb = new EventClient({ adapter: adapter() }); accountDb = new AccountClient({ adapter: adapter() })
  await eventDb.$executeRawUnsafe('SET ROLE temuevent_app')
  await accountDb.$executeRawUnsafe('SET ROLE temuevent_app')
  // F1's adopted models must read the existing shared F2 tables, without replaying its developer migration.
  assert.deepEqual(await eventDb.attendance.findMany({ take: 1 }), [])
  assert.deepEqual(await eventDb.organizerDecisionEmail.findMany({ take: 1 }), [])
  console.log('DAY7_F1_SHARED_MODELS_OK: root Prisma attendance and decision-email projections use existing shared tables')
  const fixture = sessionFixture()
  const owner = { ...testAccount, id: randomUUID(), email: 'day7-owner@example.test', role: 'ORGANIZER', referralCode: 'DAY7OWNER' }
  const other = { ...owner, id: randomUUID(), email: 'day7-other@example.test', referralCode: 'DAY7OTHER' }
  fixture.users.set(owner.email, owner); fixture.users.set(other.email, other)
  await accountDb.user.createMany({ data: [testAccount, owner, other].map(({ id, email, name, role, referralCode }) => ({ id, email, name, role, referralCode })) })
  const writer = createEventWriter(eventDb)
  let failure = 'none', removals = 0
  const accounts = createAccounts({ sessionService: fixture.service, secureCookies: false, fallthrough: true, now: fixture.now,
    organizerRepository: prismaOrganizerReadRepository(accountDb) })
  const app = createEvents({ sessionService: fixture.service, secureCookies: false, accountApi: accounts, now: fixture.now,
    imageUploader: async (_file, organizerId) => ({ secure_url: 'https://res.cloudinary.com/test/image/upload/fixture.png', public_id: `temuevent/events/${organizerId}/${randomUUID()}` }),
    imageRemover: async () => { removals++ },
    imageInUse: async id => Boolean(await eventDb.event.findFirst({ where: { imagePublicId: id }, select: { id: true } })),
    eventCreator: async input => {
      if (failure === 'before') throw new Error('simulated failure before commit')
      const event = await writer(input)
      if (failure === 'after') throw new Error('simulated lost response after commit')
      return event
    },
  })
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  async function clientFor(email) {
    let cookie = ''
    const client = createAuthClient({ fetcher: async (path, init) => {
      const headers = new Headers(init?.headers)
      if (cookie) headers.set('cookie', cookie)
      const response = await fetch(base + path, { ...init, headers })
      const cookies = response.headers.getSetCookie()
      if (cookies.length) cookie = cookies.map(value => value.split(';')[0]).join('; ')
      return response
    } })
    await client.login({ ...loginFields, email })
    return client
  }
  const ownerClient = await clientFor(owner.email), otherClient = await clientFor(other.email)
  const input = { name: 'Day 7 integrated SQL event', category: 'Test', location: 'Jakarta', description: 'Disposable F1/F2 integration',
    startAt: '2027-01-01T03:00:00Z', endAt: '2027-01-01T06:00:00Z', status: 'PUBLISHED',
    ticketTypes: [{ name: 'Regular', description: '', price: 75000, quota: 10 }] }
  const image = new File(['fixture image'], 'fixture.png', { type: 'image/png' })
  const created = await ownerClient.createEvent(input, image, owner.id)
  const stored = await accountDb.event.findUniqueOrThrow({ where: { id: created.id }, include: { ticketTypes: true } })
  assert.equal(stored.organizerId, owner.id)
  assert.match(stored.imagePublicId, new RegExp('^temuevent/events/' + owner.id + '/'))
  assert.equal(stored.ticketTypes[0].price, 75000n)
  assert.equal(stored.ticketTypes[0].availableSeats, 10)
  const own = await ownerClient.get('/api/organizer/events')
  const foreign = await otherClient.get('/api/organizer/events')
  assert(own.items.some(event => event.id === created.id))
  assert(!foreign.items.some(event => event.id === created.id))
  console.log('DAY7_SHARED_SQL_OK: shared login, real F1 event/tickets/poster persistence and F2 organizer ownership')

  failure = 'before'
  await assert.rejects(ownerClient.createEvent(input, image, owner.id), error => error.code === 'EVENT_CREATION_UNCERTAIN')
  assert.equal(removals, 1)
  assert.equal(await accountDb.event.count(), 1)
  failure = 'after'
  await assert.rejects(ownerClient.createEvent(input, image, owner.id), error => error.code === 'EVENT_CREATION_UNCERTAIN')
  assert.equal(removals, 1)
  assert.equal(await accountDb.event.count(), 2)
  assert.equal((await ownerClient.get('/api/organizer/events')).items.length, 2)
  console.log('DAY7_POSTER_RECOVERY_OK: cleanup before commit, preserve poster after uncertain committed response, no automatic duplicate write')
  console.log(`DAY7_INTEGRATION_OK: ${names.length} shared migrations; no live database or image provider used`)
} finally {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  await eventDb?.$disconnect(); await accountDb?.$disconnect()
  await pool?.end()
  await socket?.stop(); await pg.close()
}
