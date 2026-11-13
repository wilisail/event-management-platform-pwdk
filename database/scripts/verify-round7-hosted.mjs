import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile, rename } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Read-only application smoke checks; writes are attempted without an application session and must be denied. */
export async function verifyRound7Hosted({ origin, shareUrl, samples = [], report }) {
  const base = new URL(origin)
  assert.equal(base.origin, origin, 'Use an origin without a path')
  assert.equal(base.protocol, 'https:')
  assert(/^temuevent-(?:combined-qa-andor2|[a-z0-9]+-andor2)\.vercel\.app$/.test(base.hostname), 'Use the TemuEvent Preview')
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  assert(samples.every(sample => uuid.test(sample.id)), 'Use explicit sample UUIDs')
  const cookies = new Map()
  const evidence = { checkedAt: new Date().toISOString(), scope: 'ROUND7_HOSTED_F2_HANDOFF',
    sharedDataMutated: false, externalEmailSent: false, ownerStandbyRequired: false,
    credentialedRoleReplay: false, purchaseJourneyAccepted: false, evaluatorOwnSessionAccepted: false, checks: [] }
  const record = (name, response) => { evidence.checks.push({ name, status: response.status, passed: true }); console.log('ROUND7_OK:', name) }
  const capture = response => {
    for (const header of response.headers.getSetCookie()) {
      const [pair] = header.split(';'), at = pair.indexOf('=')
      const name = pair.slice(0, at)
      assert(!name.includes('temuevent'), 'This verifier must never acquire an application session')
      cookies.set(name, pair.slice(at + 1))
    }
  }
  const headers = () => cookies.size ? { cookie: [...cookies].map(([key, value]) => key + '=' + value).join('; ') } : {}
  if (shareUrl) {
    let target = new URL(shareUrl)
    assert.equal(target.origin, origin, 'Temporary Vercel access must belong to this Preview origin')
    assert(target.searchParams.has('_vercel_share'), 'Use an owner-authorized temporary Vercel link')
    let entered = false
    for (let attempt = 0; attempt < 6; attempt++) {
      const response = await fetch(target, { headers: headers(), redirect: 'manual', signal: AbortSignal.timeout(20000) })
      capture(response); await response.body?.cancel()
      if (response.status >= 300 && response.status < 400) {
        target = new URL(response.headers.get('location'), target)
        assert.equal(target.origin, origin, 'Vercel access redirected outside the selected Preview')
      } else { assert.equal(response.status, 200, 'Temporary Vercel access failed'); entered = true; break }
    }
    assert(entered, 'Temporary Vercel access did not complete')
    evidence.protectionAccess = 'Owner-authorized temporary platform access; no TemuEvent session acquired'
  }
  async function request(path, { method = 'GET', body, extraHeaders = {} } = {}) {
    const response = await fetch(new URL(path, origin), { method, headers: {
      ...headers(), ...extraHeaders,
      ...(body === undefined ? {} : { 'content-type': 'application/json', 'x-temuevent-client': 'web' }),
    }, redirect: 'manual', signal: AbortSignal.timeout(20000), ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    const text = await response.text()
    let json
    try { json = JSON.parse(text) } catch {}
    return { status: response.status, headers: response.headers, json, text }
  }
  const ready = await request('/api/ready'); assert.equal(ready.status, 200); assert.equal(ready.json?.ready, true)
  record('Readiness and database connection', ready)
  const health = await request('/api/health'); assert.equal(health.status, 200); assert.equal(health.json?.data?.sessionsConfigured, true)
  record('Application session service configured', health)
  for (const path of ['/login', '/register', '/account', '/organizer', '/forgot-password', '/reset-password']) {
    const response = await request(path); assert.equal(response.status, 200); assert(response.headers.get('content-type')?.includes('text/html'))
    record('Page shell ' + path, response)
  }
  const eventId = samples[0]?.id ?? randomUUID(), purchaseId = randomUUID()
  const denied = [
    ['/api/me', 'Signed-out identity'], ['/api/auth/csrf', 'Signed-out CSRF endpoint'],
    ['/api/me/rewards', 'Signed-out wallet'], ['/api/me/referral', 'Signed-out referral'],
    ['/api/organizer/events', 'Signed-out Organizer events'], ['/api/organizer/statistics', 'Signed-out sales totals'],
    [`/api/organizer/events/${eventId}/attendees`, 'Signed-out attendees'],
    [`/api/organizer/transactions/${purchaseId}/proof`, 'Signed-out private proof'],
    [`/api/events/${eventId}/reviews/eligibility`, 'Signed-out review eligibility'],
  ]
  for (const [path, name] of denied) {
    const response = await request(path)
    assert.equal(response.status, 401, name); assert.equal(response.json?.success, false, 'Expected application JSON, not platform protection')
    assert.equal(response.headers.get('cache-control')?.includes('no-store'), true)
    record(name + ' denied by application JSON', response)
  }
  for (const [path, name, body] of [
    ['/api/events', 'Event creation', {}],
    [`/api/events/${eventId}/reviews`, 'Review creation', { rating: 5, comment: 'This request must never be saved.' }],
    [`/api/organizer/events/${eventId}/attendance`, 'Attendance marking', { customerId: randomUUID(), transactionId: purchaseId }],
    [`/api/organizer/transactions/${purchaseId}/decision`, 'Purchase decision', { decision: 'ACCEPT' }],
    ['/api/internal/jobs/run', 'Private email worker', {}],
  ]) {
    const response = await request(path, { method: 'POST', body })
    assert.equal(response.status, 401, name); assert.equal(response.json?.success, false)
    record('Unauthenticated ' + name + ' denied', response)
  }
  const forged = await request('/api/organizer/events', { extraHeaders: { 'x-demo-persona': 'organizer' } })
  assert.equal(forged.status, 401); assert.equal(forged.json?.success, false); record('Demo header cannot become a real Organizer session', forged)
  const crossOrigin = await request('/api/me', { extraHeaders: { origin: 'https://untrusted.example.test' } })
  assert.equal(crossOrigin.status, 403); assert.equal(crossOrigin.json?.code, 'ORIGIN_NOT_ALLOWED'); record('Unapproved origin denied', crossOrigin)
  const qa = await request('/qa'); assert.equal(qa.status, 404); record('QA persona launcher absent from normal hosted app', qa)
  for (let index = 0; index < samples.length; index++) {
    const sample = samples[index], detail = await request('/api/events/' + sample.id)
    assert.equal(detail.status, 200); assert.equal(detail.json?.data?.title, sample.title)
    assert.equal(detail.json.data.price, sample.price); assert.equal(detail.json.data.availableSeats, sample.seats)
    assert.equal(Boolean(detail.json.data.image), sample.poster)
    record('Preserved public sample ' + (index + 1) + ' details and inventory', detail)
    const reviews = await request('/api/events/' + sample.id + '/reviews')
    assert.equal(reviews.status, 200); assert(Array.isArray(reviews.json?.data))
    assert.equal(detail.json.data.reviewCount, reviews.json.data.length)
    record('Preserved public sample ' + (index + 1) + ' review feed and count', reviews)
    for (const suffix of ['', '/review', '/tickets']) {
      const page = await request('/events/' + sample.id + suffix); assert.equal(page.status, 200)
      record('Preserved sample ' + (index + 1) + ' page ' + (suffix || '/detail'), page)
    }
  }
  evidence.passed = true
  evidence.checkCount = evidence.checks.length
  if (report) {
    const output = resolve(report); await mkdir(dirname(output), { recursive: true })
    await writeFile(output + '.tmp', JSON.stringify(evidence, null, 2) + '\n'); await rename(output + '.tmp', output)
  }
  console.log('ROUND7_COMPLETE:', JSON.stringify({ passed: true, checks: evidence.checkCount }))
  return evidence
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  if (args.length !== 4 || args[0] !== '--origin' || args[2] !== '--report') throw new Error('Usage: verify-round7-hosted.mjs --origin PREVIEW_ORIGIN --report OUTPUT_JSON')
  try { await verifyRound7Hosted({ origin: args[1], report: args[3], shareUrl: process.env.TEMUEVENT_QA_SHARE_URL,
    samples: JSON.parse(process.env.TEMUEVENT_QA_SAMPLES || '[]') }) }
  catch { console.error('ROUND7_FAILED: Verify Preview access and application responses; no credentials are printed.'); process.exitCode = 1 }
}
