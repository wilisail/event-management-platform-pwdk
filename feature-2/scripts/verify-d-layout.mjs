import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
const { chromium } = createRequire(import.meta.url)('playwright')
const origin = process.env.QA_ORIGIN || 'http://127.0.0.1:3000'
assert(['http://127.0.0.1:3000', 'http://127.0.0.1:3001'].includes(origin), 'Local mocked QA only')
for (let attempt = 0; ; attempt++) {
  try { if ((await fetch(origin + '/login')).ok) break } catch {}
  assert(attempt < 60, 'Local web server did not start')
  await new Promise(resolve => setTimeout(resolve, 500))
}
const browser = await chromium.launch({ headless: true,
  ...(process.env.QA_CHROMIUM_PATH ? { executablePath: process.env.QA_CHROMIUM_PATH } : {}),
})
const results = []
let activePage
const id = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const purchase = '33333333-3333-4333-8333-333333333333'
const user = { id: other, name: 'QA Organizer', email: 'qa@example.test', role: 'ORGANIZER', profilePictureUrl: null, referralCode: 'QA1234567890' }
const event = { id, name: 'QA Participant Event', category: 'Learning', location: 'Jakarta', venue: 'QA', startAt: '2026-11-13T00:00:00Z', endAt: '2026-11-13T02:00:00Z', status: 'PUBLISHED' }
const pageOf = items => ({ items, pagination: { page: 1, pageSize: 10, total: items.length, totalPages: items.length ? 1 : 0 } })
const box = locator => locator.boundingBox().then(value => { assert(value); return value })
const separate = (a,b,label) => assert(a.y+a.height <= b.y+1 || b.y+b.height <= a.y+1 || a.x+a.width <= b.x+1 || b.x+b.width <= a.x+1, label)
try {
  for (const width of [1280, 360, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    const page = await context.newPage()
    activePage = page
    page.setDefaultTimeout(10000)
    let status = 'WAITING_FOR_ADMIN_CONFIRMATION', attendeeReads = 0, role = 'ORGANIZER', signedIn = true
    const unexpected = [], errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('dialog', dialog => dialog.accept())
    const transaction = () => ({ id: purchase, reference: 'QA-D-ACCEPT', eventId: id, eventName: event.name, customerName: 'QA Customer', status,
      totalPrice: 45000, createdAt: event.startAt, decisionAvailability: status === 'DONE' ? 'CLOSED' : 'READY', proofAvailability: 'READY',
      subtotal: 50000, voucherDiscount: 0, couponDiscount: 0, pointsUsed: 5000, paymentDueAt: event.endAt, decisionDueAt: '2026-11-16T00:00:00Z', proofUploadedAt: event.startAt,
      completedAt: status === 'DONE' ? event.endAt : null, items: [{ id: other, ticketName: 'Tiket uji', quantity: 1, unitPrice: 50000, lineTotal: 50000 }] })
    await context.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url()), path = url.pathname
      let data, code = 200
      if (path === '/api/me') { data = { ...user, role }; if (!signedIn) code = 401 }
      else if (path === '/api/auth/csrf') { data = { csrfToken: 'local-qa-csrf' }; if (!signedIn) code = 401 }
      else if (path === '/api/auth/login') { signedIn = true; data = { user: { ...user, role } } }
      else if (path === '/api/auth/register') data = { user: { ...user, role: 'CUSTOMER' } }
      else if (path === '/api/organizer/events') data = pageOf([{ ...event, id: other, name: 'Different event' }, event])
      else if (path === '/api/organizer/statistics') data = { groupBy: 'day', from: '2026-11-01', to: '2026-11-14', timeZone: 'Asia/Jakarta', totals: { revenueIdr: status === 'DONE' ? 45000 : 0, purchaseCount: status === 'DONE' ? 1 : 0, ticketQuantity: status === 'DONE' ? 1 : 0 }, periods: [{ startDate: '2026-11-14', revenueIdr: 45000, purchaseCount: 1, ticketQuantity: 1 }] }
      else if (path === '/api/organizer/transactions') data = pageOf([transaction()])
      else if (path === `/api/organizer/transactions/${purchase}`) data = transaction()
      else if (path === `/api/organizer/transactions/${purchase}/decision` && request.method() === 'POST') { status = 'DONE'; data = { id: purchase, status } }
      else if (path === `/api/organizer/events/${id}/attendees`) { attendeeReads++; data = pageOf(status === 'DONE' ? [{ purchaseId: purchase, purchaseReference: 'QA-D-ACCEPT', customerId: other, name: 'QA Customer', ticketQuantity: 1, totalPaid: 45000, attendedAt: null }] : []) }
      else if (path === '/api/me/wallet') data = { userId: other, asOf: event.startAt, currency: 'IDR', availablePoints: 5000, pointValueIdr: 1, pointGrants: [], coupons: [], policy: { referralAwardPoints: 10000, validityCalendarMonths: 3, couponAmountIsDemo: true } }
      else if (path === '/api/me/referral') data = { referralCode: 'QA1234567890', referredCount: 0 }
      else { unexpected.push(path); code = 500 }
      await route.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify(code === 200 ? { success: true, data } : { success: false, code: code === 401 ? 'UNAUTHORIZED' : 'UNEXPECTED_QA_REQUEST', message: 'QA only' }) })
    })
    await page.goto(origin + '/organizer')
    await page.getByText('Belum ada event dipilih.', { exact: false }).waitFor()
    await page.getByRole('button', { name: 'Lihat peserta: QA Participant Event', exact: true }).click()
    await page.getByText('Belum ada pendaftaran terkonfirmasi pada halaman ini.', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Lihat detail transaksi QA-D-ACCEPT', exact: true }).click()
    const detail = page.getByRole('region', { name: 'Detail transaksi', exact: true })
    await detail.getByRole('link', { name: 'Lihat bukti pembayaran' }).waitFor()
    const proof = await box(detail.getByRole('link', { name: 'Lihat bukti pembayaran' }))
    assert(proof.height >= 44, 'Proof link has a real button box')
    separate(await box(detail.locator('.transaction-proof > p')), proof, 'Proof link does not overlap upload text')
    separate(proof, await box(detail.getByRole('button', { name: 'Terima pembayaran' })), 'Proof and decision controls do not overlap')
    separate(await box(detail.getByRole('button', { name: 'Terima pembayaran' })), await box(detail.getByRole('button', { name: 'Tolak pembayaran' })), 'Decision controls do not overlap')
    await detail.getByRole('button', { name: 'Terima pembayaran' }).click()
    await page.getByRole('region', { name: 'Tabel peserta terkonfirmasi', exact: true }).getByText('QA Customer', { exact: true }).waitFor()
    assert(attendeeReads >= 2, 'An already selected empty list refreshes after approval')
    await page.getByRole('button', { name: 'Lihat peserta event ini' }).click()
    const selected = page.getByRole('button', { name: 'Lihat peserta: QA Participant Event', exact: true })
    assert.equal(await selected.getAttribute('aria-pressed'), 'true', 'Decision uses event ID, not the first event')
    await page.getByRole('button', { name: 'Perbarui peserta' }).click()
    await page.getByRole('region', { name: 'Tabel peserta terkonfirmasi', exact: true }).waitFor()
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No page overflow')
    await page.screenshot({ path: `/tmp/temuevent-d-organizer-${width}.png`, fullPage: true })
    role = 'CUSTOMER'
    await page.reload()
    await page.getByRole('heading', { name: 'Halaman khusus organizer.' }).waitFor()
    const alert = page.getByRole('alert')
    const back = await box(alert.getByRole('link', { name: 'Kembali ke akun saya' }))
    assert(back.height >= 44)
    separate(await box(alert.locator('p').last()), back, '403 return link does not overlap text')
    // Sign-in uses a safe, role-aware destination; no actual account is created or changed.
    signedIn = false
    await page.goto(origin + '/login?next=%2Forganizer')
    await page.getByLabel('Email', { exact: true }).fill('qa@example.test')
    await page.getByLabel('Kata sandi', { exact: true }).fill('Local QA fixture only 123')
    await page.getByRole('button', { name: 'Masuk', exact: true }).click()
    await page.waitForURL(origin + '/account')
    signedIn = false
    await page.goto(origin + '/register')
    await page.getByLabel('Nama', { exact: true }).fill('QA Customer')
    await page.getByLabel('Email', { exact: true }).fill('qa@example.test')
    await page.getByLabel('Kata sandi', { exact: true }).fill('Local QA fixture only 123')
    await page.getByRole('button', { name: 'Buat akun', exact: true }).click()
    const created = page.getByRole('status').filter({ has: page.getByRole('heading', { name: 'Siap untuk masuk.' }) })
    const login = await box(created.getByRole('link', { name: 'Lanjut ke halaman masuk' }))
    assert(login.height >= 44)
    separate(await box(created.locator('p')), login, 'Signup return link does not overlap text')
    assert.deepEqual(unexpected, []); assert.deepEqual(errors, [])
    results.push({ width, approvalRefresh: true, correctParticipantEvent: true, proofControlsSeparated: true, customerReturn: '/account', guardedOrganizerPage: true, signupLinkSeparated: true, pageOverflow: false })
    await context.close()
  }
  const evidence = { mode: 'isolated browser with mocked API; no live account or email mutations', origin, results }
  if (process.env.QA_EVIDENCE) await writeFile(process.env.QA_EVIDENCE, JSON.stringify(evidence, null, 2) + '\n')
  console.log(JSON.stringify(evidence))
} catch (error) {
  console.error('QA page:', await activePage?.locator('body').innerText().catch(() => 'unavailable'))
  throw error
} finally { await browser.close() }
