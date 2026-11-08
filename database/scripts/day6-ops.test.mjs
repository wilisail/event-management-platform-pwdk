import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { cleanupSql, fixtureManifest, statusSql } from './day6-ops.mjs'

function manifest() {
  return {
    users: ['CUSTOMER', 'ORGANIZER', 'ORGANIZER'].map((role, index) => ({
      id: randomUUID(), email: `day6-test-${index}@example.test`, role, password: 'PRIVATE_PASSWORD_MUST_NOT_APPEAR',
    })),
    eventId: randomUUID(), ticketId: randomUUID(), purchaseId: randomUUID(), itemId: randomUUID(),
  }
}

test('the manifest rejects ordinary accounts, malformed IDs and ambiguous fixture roles', () => {
  const qa = manifest()
  assert.equal(JSON.stringify(fixtureManifest(qa)).includes('PRIVATE_PASSWORD'), false)
  assert.equal(cleanupSql(qa, true).includes('PRIVATE_PASSWORD'), false)
  assert.throws(() => fixtureManifest({ ...qa, eventId: "'; DELETE FROM temuevent.users;--" }))
  assert.throws(() => fixtureManifest({ ...qa, users: qa.users.map(u => ({ ...u, email: 'real@example.com' })) }))
  assert.throws(() => fixtureManifest({ ...qa, users: [...qa.users].reverse() }))
  assert.throws(() => fixtureManifest({ ...qa, ticketId: qa.eventId }))
  assert.doesNotMatch(cleanupSql(qa), /\b(?:DELETE|UPDATE|INSERT|DO)\b/)
})

test('cleanup is bounded, rolls back unexpected references, removes sessions, and can run twice', async () => {
  const db = await PGlite.create()
  const qa = manifest(), externalUser = randomUUID(), externalPurchase = randomUUID()
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;')
    const root = new URL('../prisma/migrations/', import.meta.url)
    const migrations = readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort()
    for (const name of migrations) await db.exec(readFileSync(new URL(name + '/migration.sql', root), 'utf8'))
    for (const [index, user] of qa.users.entries()) {
      await db.query('INSERT INTO temuevent.users(id,email,name,role,referral_code) VALUES($1,$2,$3,$4,$5)',
        [user.id, user.email, 'QA fixture', user.role, 'OPSQA' + index])
    }
    await db.query("INSERT INTO temuevent.users(id,email,name,referral_code) VALUES($1,'preserved@example.com','Preserved user','PRESERVED')", [externalUser])
    await db.query("INSERT INTO temuevent.events(id,organizer_id,slug,name,category,location,start_at,end_at) VALUES($1,$2,$3,'QA','Test','Jakarta',now(),now()+interval '1 day')",
      [qa.eventId, qa.users[1].id, 'day6-qa-' + qa.eventId])
    await db.query("INSERT INTO temuevent.ticket_types(id,event_id,name,price,quota,available_seats) VALUES($1,$2,'QA',75000,10,8)", [qa.ticketId, qa.eventId])
    await db.query("INSERT INTO temuevent.purchases(id,reference,customer_id,event_id,status,subtotal,total_price,completed_at) VALUES($1,$2,$3,$4,'DONE',150000,150000,now())",
      [qa.purchaseId, 'DAY6-QA-' + qa.purchaseId, qa.users[0].id, qa.eventId])
    await db.query('INSERT INTO temuevent.purchase_items(id,event_id,purchase_id,ticket_type_id,quantity,unit_price,line_total) VALUES($1,$2,$3,$4,2,75000,150000)',
      [qa.itemId, qa.eventId, qa.purchaseId, qa.ticketId])
    await db.query('INSERT INTO temuevent.attendance(event_id,customer_id,transaction_id,marked_by_organizer_id) VALUES($1,$2,$3,$4)',
      [qa.eventId, qa.users[0].id, qa.purchaseId, qa.users[1].id])
    const sessionId = randomUUID()
    await db.query("INSERT INTO temuevent.auth_sessions(id,user_id,expires_at) VALUES($1,$2,now()+interval '1 day')", [sessionId, qa.users[0].id])
    await db.query("INSERT INTO temuevent.auth_refresh_tokens(session_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 day')", [sessionId, 'a'.repeat(64)])
    const before = (await db.query(cleanupSql(qa))).rows[0].fixture_counts
    assert.deepEqual(before, { users: 3, sessions: 1, refreshTokens: 1, events: 1, tickets: 1, purchases: 1, items: 1, attendance: 1, decisionEmails: 0, resetJobs: 0 })

    const wrongIdentity = { ...qa, users: qa.users.map((u, i) => i === 0 ? { ...u, email: 'day6-wrong@example.test' } : u) }
    await assert.rejects(db.exec(cleanupSql(wrongIdentity, true)), /QA identity mismatch/)
    assert.deepEqual((await db.query(cleanupSql(qa))).rows[0].fixture_counts, before)

    // A real customer's unexpected purchase must block every deletion, including sessions.
    await db.query("INSERT INTO temuevent.purchases(id,reference,customer_id,event_id,status,subtotal,total_price,completed_at) VALUES($1,'external-purchase',$2,$3,'DONE',75000,75000,now())", [externalPurchase, externalUser, qa.eventId])
    await assert.rejects(db.exec(cleanupSql(qa, true)), { code: '23503' })
    assert.deepEqual((await db.query(cleanupSql(qa))).rows[0].fixture_counts, before)
    await db.query('DELETE FROM temuevent.purchases WHERE id=$1', [externalPurchase])
    await db.exec(cleanupSql(qa, true))
    const after = (await db.query(cleanupSql(qa))).rows[0].fixture_counts
    assert(Object.values(after).every(value => value === 0))
    await db.exec(cleanupSql(qa, true))
    assert.equal((await db.query('SELECT count(*)::int AS count FROM temuevent.users WHERE id=$1', [externalUser])).rows[0].count, 1)
    assert.equal((await db.query('SELECT count(*)::int AS count FROM temuevent.auth_refresh_tokens')).rows[0].count, 0)

    // Validate status SQL without any external database, Vault contents or HTTP requests.
    await db.exec(`CREATE TABLE temuevent._prisma_migrations(migration_name text,checksum text,finished_at timestamptz,rolled_back_at timestamptz);
      CREATE SCHEMA cron; CREATE TABLE cron.job(jobid int,jobname text,schedule text,active bool,command text);
      CREATE TABLE cron.job_run_details(jobid int,status text,start_time timestamptz,end_time timestamptz);
      CREATE SCHEMA net; CREATE TABLE net._http_response(id int,status_code int,timed_out bool,created timestamptz,content text);
      INSERT INTO cron.job VALUES(1,'temuevent-preview-email-jobs','* * * * *',true,'SELECT FROM vault.decrypted_secrets');
      INSERT INTO cron.job_run_details VALUES(1,'succeeded',now(),now());`)
    for (const name of migrations) await db.query('INSERT INTO temuevent._prisma_migrations VALUES($1,$2,now(),null)',
      [name, createHash('sha256').update(readFileSync(new URL(name + '/migration.sql', root))).digest('hex')])
    await db.query('INSERT INTO net._http_response VALUES(1,200,false,now(),$1)', [JSON.stringify({ success: true, passwordReset: true, decisionEmails: true, secret: 'DO_NOT_EXPOSE' })])
    const status = (await db.query(statusSql())).rows[0].ops_status
    assert.equal(status.migrations.length, 9)
    assert(status.migrations.every(row => row.current))
    assert.equal(status.tables.length, 4)
    assert(status.tables.every(row => row.rls))
    assert.equal(status.scheduler[0].usesVault, true)
    assert.equal(status.workerResponses[0].fresh, true)
    assert.equal(JSON.stringify(status).includes('DO_NOT_EXPOSE'), false)
    await db.query("UPDATE temuevent._prisma_migrations SET checksum='changed' WHERE migration_name=$1", [migrations[0]])
    assert.equal((await db.query(statusSql())).rows[0].ops_status.migrations.find(row => row.name === migrations[0]).current, false)
  } finally { await db.close() }
})
