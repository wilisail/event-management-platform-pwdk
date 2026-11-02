import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { databaseClient, disconnectDatabase } from '../src/client'

const db = databaseClient()
const connection = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 8000,
})
const rollback = new Error('ROLLBACK_REVIEW_MAPPING_CHECK')
let stage = 'backend connection'
const snapshot = `SELECT
  (SELECT md5(string_agg(to_jsonb(u)::text, '' ORDER BY u.id)) FROM temuevent.users u) AS users,
  (SELECT md5(string_agg(to_jsonb(e)::text, '' ORDER BY e.id)) FROM temuevent.events e) AS events,
  (SELECT md5(string_agg(to_jsonb(r)::text, '' ORDER BY r.id)) FROM temuevent.reviews r) AS reviews,
  (SELECT count(*)::int FROM temuevent.purchases) AS purchases`

async function main() {
  await connection.connect()
  assert.equal((await connection.query('SELECT current_user')).rows[0].current_user, 'temuevent_app')
  const before = (await connection.query(snapshot)).rows

  stage = 'SQL constraints, RLS and role privileges'
  const sql = await readFile('scripts/verify-reviews.sql', 'utf8')
  await connection.query(sql)

  stage = 'Prisma create and bidirectional user/event joins'
  const organizer = await db.user.findUniqueOrThrow({
    where: { email: 'organizer@example.test' }, select: { id: true },
  })
  await assert.rejects(db.$transaction(async tx => {
    const suffix = randomUUID().replaceAll('-', '')
    const user = await tx.user.create({ data: {
      email: `review-check-${suffix}@example.test`, name: 'Rollback Prisma reviewer',
      role: 'CUSTOMER', referralCode: suffix.slice(0, 16),
    } })
    const event = await tx.event.create({ data: {
      organizerId: organizer.id, slug: `review-check-${suffix}`, name: 'Rollback Prisma review event',
      category: 'Test', location: 'Test',
      startAt: new Date(Date.now() - 172800000), endAt: new Date(Date.now() - 86400000),
    } })
    const review = await tx.review.create({
      data: { eventId: event.id, userId: user.id, rating: 5, comment: null },
      include: { event: true, user: true },
    })
    assert.equal(review.event.id, event.id)
    assert.equal(review.user.id, user.id)
    assert.equal(review.comment, null)
    const author = await tx.user.findUniqueOrThrow({ where: { id: user.id }, include: { reviews: true } })
    const reviewedEvent = await tx.event.findUniqueOrThrow({ where: { id: event.id }, include: { reviews: true } })
    assert.equal(author.reviews[0].id, review.id)
    assert.equal(reviewedEvent.reviews[0].id, review.id)
    throw rollback
  }, { timeout: 15000 }), error => error === rollback)

  stage = 'rollback preservation'
  assert.deepEqual((await connection.query(snapshot)).rows, before)
  console.log(JSON.stringify({
    result: 'REVIEW_SCHEMA_DB_OK',
    passed: ['Backend SELECT/INSERT and no schema creation', 'No Data API table grants; RLS enabled',
      'Ratings 1 and 5 accepted; 0/6/null rejected', 'Duplicate author/event and invalid links rejected',
      'Real Prisma create and both inverse relationships', 'All fixture writes rolled back; snapshots preserved'],
    scope: 'Review storage only; F1 review HTTP API and F2 attendance eligibility remain separate',
  }, null, 2))
}

main().catch((error: unknown) => {
  console.error('Review schema verification failed at: ' + stage)
  if (error && typeof error === 'object' && 'code' in error) console.error('Error code: ' + String(error.code))
  process.exitCode = 1
}).finally(async () => {
  await connection.query('ROLLBACK').catch(() => undefined)
  await connection.end()
  await disconnectDatabase()
})
