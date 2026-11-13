import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import pg from 'pg'

const projectRef = 'rjjwjacihxepticquxxa'
const quote = value => "'" + value.replaceAll("'", "''") + "'"
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Passwords in an old private QA manifest are deliberately discarded.
export function fixtureManifest(input) {
  if (!input || !Array.isArray(input.users) || input.users.length !== 3) throw new Error('Expected three disposable QA identities')
  const users = input.users.map(({ id, email, role }) => {
    if (!uuidPattern.test(id) || typeof email !== 'string' || !/^day6[-+_.a-z0-9]*@example\.test$/i.test(email) || !['CUSTOMER', 'ORGANIZER'].includes(role)) {
      throw new Error('Cleanup accepts only named Day 6 example.test fixtures')
    }
    return { id, email, role }
  })
  if (users.filter(user => user.role === 'CUSTOMER').length !== 1 || users[0].role !== 'CUSTOMER' || users[1].role !== 'ORGANIZER' || users[2].role !== 'ORGANIZER') {
    throw new Error('Expected customer, owning organizer, other organizer order')
  }
  const ids = Object.fromEntries(['eventId', 'ticketId', 'purchaseId', 'itemId'].map(key => {
    if (!uuidPattern.test(input[key])) throw new Error('Expected explicit fixture UUIDs')
    return [key, input[key]]
  }))
  if (new Set([...users.map(user => user.id), ...Object.values(ids)]).size !== 7) throw new Error('Fixture UUIDs must be distinct')
  return { users, ...ids }
}

function fixtureCounts(manifest) {
  const m = fixtureManifest(manifest)
  const userIds = 'ARRAY[' + m.users.map(user => quote(user.id)).join(',') + ']::uuid[]'
  return `SELECT jsonb_build_object(
    'users', (SELECT count(*) FROM temuevent.users WHERE id = ANY(${userIds})),
    'sessions', (SELECT count(*) FROM temuevent.auth_sessions WHERE user_id = ANY(${userIds})),
    'refreshTokens', (SELECT count(*) FROM temuevent.auth_refresh_tokens t JOIN temuevent.auth_sessions s ON s.id = t.session_id WHERE s.user_id = ANY(${userIds})),
    'events', (SELECT count(*) FROM temuevent.events WHERE id = ${quote(m.eventId)}::uuid),
    'tickets', (SELECT count(*) FROM temuevent.ticket_types WHERE id = ${quote(m.ticketId)}::uuid),
    'purchases', (SELECT count(*) FROM temuevent.purchases WHERE id = ${quote(m.purchaseId)}::uuid),
    'items', (SELECT count(*) FROM temuevent.purchase_items WHERE id = ${quote(m.itemId)}::uuid),
    'attendance', (SELECT count(*) FROM temuevent.attendance WHERE transaction_id = ${quote(m.purchaseId)}::uuid),
    'decisionEmails', (SELECT count(*) FROM temuevent.organizer_decision_emails WHERE purchase_id = ${quote(m.purchaseId)}::uuid),
    'resetJobs', (SELECT count(*) FROM temuevent.password_reset_tokens WHERE user_id = ANY(${userIds}))
  ) AS fixture_counts`
}

export function cleanupSql(input, apply = false) {
  const m = fixtureManifest(input)
  const counts = fixtureCounts(m)
  if (!apply) return counts + ';\n'
  const qid = key => quote(m[key]) + '::uuid'
  const userIds = 'ARRAY[' + m.users.map(user => quote(user.id)).join(',') + ']::uuid[]'
  const identities = m.users.map(user => `(${quote(user.id)}::uuid, ${quote(user.email)}, ${quote(user.role)})`).join(',\n')
  return `-- Atomic, bounded cleanup. Unexpected references abort the entire operation.
DO $temu_ops$
DECLARE remaining jsonb;
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);
  PERFORM set_config('statement_timeout', '20s', true);
  PERFORM id FROM temuevent.users WHERE id = ANY(${userIds}) ORDER BY id FOR UPDATE;
  PERFORM id FROM temuevent.events WHERE id = ${qid('eventId')} FOR UPDATE;
  PERFORM id FROM temuevent.purchases WHERE id = ${qid('purchaseId')} FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM temuevent.users u JOIN (VALUES ${identities}) AS qa(id,email,role) ON qa.id = u.id
    WHERE lower(u.email) <> lower(qa.email) OR u.role::text <> qa.role
  ) THEN RAISE EXCEPTION 'QA identity mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM temuevent.events WHERE id = ${qid('eventId')}
    AND (organizer_id <> ${quote(m.users[1].id)}::uuid OR slug <> ${quote('day6-qa-' + m.eventId)}))
    THEN RAISE EXCEPTION 'QA event mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM temuevent.purchases WHERE id = ${qid('purchaseId')}
    AND (event_id <> ${qid('eventId')} OR customer_id <> ${quote(m.users[0].id)}::uuid OR reference <> ${quote('DAY6-QA-' + m.purchaseId)}))
    THEN RAISE EXCEPTION 'QA purchase mismatch'; END IF;
  DELETE FROM temuevent.auth_sessions WHERE user_id = ANY(${userIds});
  DELETE FROM temuevent.attendance WHERE transaction_id = ${qid('purchaseId')}
    AND event_id = ${qid('eventId')} AND customer_id = ${quote(m.users[0].id)}::uuid
    AND marked_by_organizer_id = ${quote(m.users[1].id)}::uuid;
  DELETE FROM temuevent.organizer_decision_emails WHERE purchase_id = ${qid('purchaseId')}
    AND recipient_email = ${quote(m.users[0].email)};
  DELETE FROM temuevent.purchase_items WHERE id = ${qid('itemId')} AND purchase_id = ${qid('purchaseId')}
    AND event_id = ${qid('eventId')} AND ticket_type_id = ${qid('ticketId')};
  DELETE FROM temuevent.purchases WHERE id = ${qid('purchaseId')} AND event_id = ${qid('eventId')}
    AND customer_id = ${quote(m.users[0].id)}::uuid;
  DELETE FROM temuevent.ticket_types WHERE id = ${qid('ticketId')} AND event_id = ${qid('eventId')};
  DELETE FROM temuevent.events WHERE id = ${qid('eventId')} AND organizer_id = ${quote(m.users[1].id)}::uuid;
  -- Session/refresh/reset rows cascade from these exact QA identities only.
  DELETE FROM temuevent.users WHERE id = ANY(${userIds});
  SELECT fixture_counts INTO remaining FROM (${counts}) AS c;
  IF EXISTS (SELECT 1 FROM jsonb_each_text(remaining) WHERE value::bigint <> 0)
    THEN RAISE EXCEPTION 'QA cleanup left unexpected references'; END IF;
END $temu_ops$;
${counts};\n`
}

export function statusSql() {
  const root = new URL('../prisma/migrations/', import.meta.url)
  const expected = readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
    .map(name => `(${quote(name)}, ${quote(createHash('sha256').update(readFileSync(new URL(name + '/migration.sql', root))).digest('hex'))})`).join(',\n')
  return `WITH expected(name,checksum) AS (VALUES ${expected})
SELECT jsonb_build_object(
  'checkedAt', now(),
  'migrations', (SELECT jsonb_agg(jsonb_build_object('name',e.name,'current',m.finished_at IS NOT NULL AND m.rolled_back_at IS NULL AND m.checksum = e.checksum) ORDER BY e.name)
    FROM expected e LEFT JOIN temuevent._prisma_migrations m ON m.migration_name = e.name AND m.rolled_back_at IS NULL),
  'tables', (SELECT jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity)) FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'temuevent' AND c.relname IN ('password_reset_tokens','reviews','attendance','organizer_decision_emails')),
  'scheduler', (SELECT jsonb_agg(jsonb_build_object('name',jobname,'active',active,'schedule',schedule,'usesVault',command LIKE '%vault.decrypted_secrets%'))
    FROM cron.job WHERE jobname = 'temuevent-preview-email-jobs'),
  'cronRuns', (SELECT jsonb_agg(to_jsonb(r)) FROM (SELECT status,start_time,end_time FROM cron.job_run_details
    WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'temuevent-preview-email-jobs') ORDER BY start_time DESC LIMIT 5) r),
  'workerResponses', (SELECT jsonb_agg(to_jsonb(r)) FROM (SELECT id,status_code,timed_out,created,
    now() - created < interval '3 minutes' AS fresh,
    content::jsonb->'success' AS success,content::jsonb->'passwordReset' AS password_reset,content::jsonb->'decisionEmails' AS decision_emails
    FROM net._http_response WHERE content LIKE '{%' AND content LIKE '%"passwordReset"%' AND content LIKE '%"decisionEmails"%'
    ORDER BY id DESC LIMIT 5) r)
) AS ops_status;\n`
}

const help = `TemuEvent Day 6 operations (Node 22.12+)
  node scripts/day6-ops.mjs status --sql
  node scripts/day6-ops.mjs cleanup --fixtures /private/qa.json --sql
  node scripts/day6-ops.mjs cleanup --fixtures /private/qa.json --apply --sql
Replace --sql with --execute to use private F2_OPS_DATABASE_URL.
Cleanup is a read-only count unless --apply is supplied. SQL output never contains passwords.
Status never applies migrations, changes Cron, calls the worker, or sends email.`

async function main() {
  const args = process.argv.slice(2)
  if (!args.length || args.includes('--help')) { console.log(help); return }
  const action = args.shift(), flags = new Set(), values = {}
  while (args.length) {
    const flag = args.shift()
    if (flag === '--fixtures') { values.fixtures = args.shift(); if (!values.fixtures) throw new Error('Missing fixture path') }
    else if (['--sql','--execute','--apply'].includes(flag)) { if (flags.has(flag)) throw new Error('Duplicate flag'); flags.add(flag) }
    else throw new Error('Unknown argument')
  }
  if (!['status','cleanup'].includes(action) || flags.has('--sql') === flags.has('--execute') || (action === 'status' && (flags.has('--apply') || values.fixtures))) throw new Error('Choose an action and exactly one output mode')
  const sql = action === 'status' ? statusSql() : cleanupSql(JSON.parse(readFileSync(values.fixtures, 'utf8')), flags.has('--apply'))
  if (flags.has('--sql')) { process.stdout.write(sql); return }
  const url = new URL(process.env.F2_OPS_DATABASE_URL || '')
  const direct = url.hostname === 'db.' + projectRef + '.supabase.co'
  const pooler = /^aws-\d+-ap-southeast-1\.pooler\.supabase\.com$/.test(url.hostname) && decodeURIComponent(url.username).endsWith('.' + projectRef)
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || (!direct && !pooler) || url.searchParams.get('schema') !== 'temuevent') throw new Error('Wrong operations database target')
  for (const key of ['schema','ssl','sslmode','sslaccept','sslcert','sslrootcert']) url.searchParams.delete(key)
  const db = new pg.Client({ connectionString: url.toString(), ssl: { ca: readFileSync(new URL('../certs/prod-ca-2021.crt', import.meta.url), 'utf8'), rejectUnauthorized: true }, connectionTimeoutMillis: 10000, query_timeout: 30000 })
  try {
    await db.connect()
    const result = await db.query(sql)
    const rows = (Array.isArray(result) ? result : [result]).flatMap(item => item.rows)
    console.log(JSON.stringify(rows, null, 2))
  } finally { await db.end() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error('Operations did not complete; no credentials or database error payload were logged.'); if (error?.code && /^[A-Z0-9_]{2,20}$/.test(error.code)) console.error('Code: ' + error.code); process.exitCode = 1 })
}
