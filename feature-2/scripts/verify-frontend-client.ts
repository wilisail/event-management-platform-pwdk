import assert from 'node:assert/strict'
import { createAuthClient, AuthApiError } from '../lib/auth-client'
import type { UserView, PageView, EventSummaryView, AttendeePurchaseView } from '../contracts/types'

// Run only against serve-browser-check.ts: every database write is rolled back there.
const base = process.env.BROWSER_QA_ORIGIN
const customer = process.env.BROWSER_QA_CUSTOMER_EMAIL
const organizer = process.env.BROWSER_QA_ORGANIZER_EMAIL
const password = process.env.BROWSER_QA_PASSWORD
const qaPid = Number(process.env.BROWSER_QA_PID)
if (process.env.BROWSER_QA_ENABLE !== 'true' || !base || !customer || !organizer || !password || !Number.isSafeInteger(qaPid) || qaPid <= 1) {
  throw new Error('Explicit disposable frontend QA settings and server PID are required')
}

async function main() {
  const origin = new URL(base!)
  assert.equal(origin.protocol, 'https:')
  const jar = new Map<string, string>()
  const calls: string[] = []
  let checkedCookieAttributes = false
  const fetcher: typeof fetch = async (input, init) => {
    assert.equal(typeof input, 'string')
    const target = new URL(input as string, origin)
    assert.equal(target.origin, origin.origin)
    const headers = new Headers(init?.headers)
    headers.set('origin', origin.origin)
    if (jar.size) headers.set('cookie', [...jar].map(([key, value]) => key + '=' + value).join('; '))
    calls.push((init?.method ?? 'GET') + ' ' + target.pathname)
    const response = await fetch(target, { ...init, headers, signal: init?.signal ?? AbortSignal.timeout(15000) })
    const cookies = response.headers.getSetCookie()
    for (const cookie of cookies) {
      const [pair] = cookie.split(';'), equal = pair.indexOf('=')
      const name = pair.slice(0, equal), value = pair.slice(equal + 1)
      if (value && !/max-age=0(?:;|$)/i.test(cookie)) jar.set(name, value)
      else jar.delete(name)
      if (value && name.startsWith('__Host-')) {
        assert.match(cookie, /;\s*Secure(?:;|$)/i)
        assert.match(cookie, /;\s*HttpOnly(?:;|$)/i)
        assert.match(cookie, /;\s*SameSite=Lax(?:;|$)/i)
        assert.match(cookie, /;\s*Path=\/(?:;|$)/i)
        checkedCookieAttributes = true
      }
    }
    return response
  }
  const client = createAuthClient({ fetcher, coordinate: async work => await work() })
  const registered = await client.register({ name: 'Frontend Check Customer', email: customer!, password: password!, role: 'CUSTOMER' })
  assert.equal(registered.user.role, 'CUSTOMER')
  assert.ok(registered.user.referralCode)
  await assert.rejects(client.me(), error => error instanceof AuthApiError && error.status === 401)
  assert.equal((await client.login({ email: customer!, password: password! })).id, registered.user.id)
  assert.equal((await client.me()).id, registered.user.id)
  await assert.rejects(client.get('/api/organizer/events'), error => error instanceof AuthApiError && error.status === 403)
  await client.logout()
  await assert.rejects(client.me(), error => error instanceof AuthApiError && error.status === 401)

  const owner = await client.login({ email: organizer!, password: password! })
  assert.equal(owner.role, 'ORGANIZER')
  const events = await client.get<PageView<EventSummaryView>>('/api/organizer/events')
  assert.equal(events.items.length, 1)
  assert.equal(events.items[0].name, 'TemuEvent Browser Check')
  const attendees = await client.get<PageView<AttendeePurchaseView>>('/api/organizer/events/' + events.items[0].id + '/attendees')
  assert.equal(attendees.items.length, 1)
  assert.equal(attendees.items[0].ticketQuantity, 2)
  assert.equal(attendees.items[0].totalPaid, 100000)
  const refreshes = () => calls.filter(value => value === 'POST /api/auth/refresh').length
  const before = refreshes()
  process.kill(qaPid, 'SIGUSR1')
  const [one, two] = await Promise.all([client.me(), client.get<UserView>('/api/me')])
  assert.equal(one.id, owner.id)
  assert.equal(two.id, owner.id)
  assert.equal(refreshes() - before, 1)
  await client.logout()
  await assert.rejects(client.me(), error => error instanceof AuthApiError && error.status === 401)
  assert.equal(checkedCookieAttributes, true)
  assert.equal(jar.size, 0)
  console.log('FRONTEND_CLIENT_OK: signup, separate login, identity, customer denial, owned event/attendees, single refresh, logout; HTTPS proxy and secure cookie attributes verified')
}
main().catch(() => { console.error('Frontend client verification failed; no credentials or cookie values logged'); process.exitCode = 1 })
