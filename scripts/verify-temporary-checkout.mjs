import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(new URL('../feature-2/package.json', import.meta.url))
const { chromium } = require('playwright')
const origin = process.env.QA_ORIGIN || 'http://127.0.0.1:3000'
const api = process.env.TEMP_CHECKOUT_API || 'http://127.0.0.1:4003'
assert(['http://127.0.0.1:3000', 'http://127.0.0.1:3002'].includes(origin))
assert.equal(new URL(api).hostname, '127.0.0.1', 'Disposable local backend only')
let fixtures
for (let attempt = 0; attempt < 100; attempt++) {
  try {
    const value = await (await fetch(api + '/__isolated-fixtures')).json()
    if (value.fixtures?.length === 3) { fixtures = value.fixtures; break }
  } catch { /* The isolated runtime is still starting. */ }
  await new Promise(resolve => setTimeout(resolve, 500))
}
assert(fixtures, 'Start database/scripts/verify-temporary-checkout.mjs --serve first')
const png = await require('sharp')({ create: { width: 400, height: 200, channels: 3, background: '#5148df' } }).png().toBuffer()
const browser = await chromium.launch({ headless: true,
  ...(process.env.QA_CHROMIUM_PATH ? { executablePath: process.env.QA_CHROMIUM_PATH } : {}),
})
const results = []
let activePage
async function contextFor(f, organizer = false) {
  const context = await browser.newContext({ viewport: { width: f.width, height: 900 } })
  let dropCheckoutReply = !organizer && f.width === 1280
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    // Forward real UI requests to the real runtime and disposable SQL, never synthesize a success payload.
    const response = await route.fetch({ url: api + url.pathname + url.search })
    if (dropCheckoutReply && url.pathname === '/api/checkout/purchases' && route.request().method() === 'POST') {
      assert.equal(response.status(), 201)
      dropCheckoutReply = false
      await route.abort('failed') // Commit succeeded; the client must reconnect the same purchase identity.
      return
    }
    await route.fulfill({ response })
  })
  const login = await context.request.post(api + '/api/auth/login', { headers: { 'x-temuevent-client': 'web' },
    data: { email: organizer ? f.organizerEmail : f.email, password: f.password } })
  assert.equal(login.status(), 200)
  return context
}
try {
  for (const f of fixtures) {
    const context = await contextFor(f), page = await context.newPage(), errors = []
    activePage = page
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${origin}/events/${f.eventId}/tickets`)
    await page.getByRole('heading', { name: 'Pilih tiket & periksa pesanan', exact: true }).waitFor()
    await page.getByLabel('Kupon referral', { exact: true }).selectOption(f.couponId)
    await page.getByLabel('Poin yang digunakan', { exact: true }).fill('5000')
    await page.getByRole('button', { name: 'Tambah Test ticket', exact: true }).click()
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Checkout has no horizontal overflow')
    await page.screenshot({ path: `/tmp/temuevent-temporary-checkout-${f.width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Periksa pesanan', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Konfirmasi pesanan', exact: true })
    await dialog.getByRole('button', { name: 'Buat pesanan', exact: true }).click()
    if (f.width === 1280) await page.getByRole('button', { name: 'Sambungkan pesanan kembali', exact: true }).click()
    await page.waitForURL(/\/transactions\/[0-9a-f-]{36}$/)
    const id = new URL(page.url()).pathname.split('/').at(-1)
    await page.getByRole('heading', { name: 'Menunggu pembayaran', exact: true }).waitFor()
    const saved = await (await context.request.get(api + '/api/me/purchases/' + id)).json()
    assert.equal(saved.data.totalPrice, 70000); assert.equal(saved.data.items[0].quantity, 1)
    assert.equal(saved.data.pointsUsed, 5000); assert.equal(saved.data.couponDiscount, 25000)
    const ownPurchases = await (await context.request.get(api + '/api/me/purchases')).json()
    assert.equal(ownPurchases.data.length, 1, 'Lost response/retry must not create another purchase')
    await page.reload()
    await page.getByRole('heading', { name: 'Menunggu pembayaran', exact: true }).waitFor()
    await page.getByLabel('Bukti pembayaran', { exact: true }).setInputFiles({ name: 'isolated-proof.png', mimeType: 'image/png', buffer: png })
    await page.getByRole('button', { name: 'Kirim bukti pembayaran', exact: true }).click()
    await page.getByRole('heading', { name: 'Menunggu konfirmasi organizer', exact: true }).waitFor()
    await page.reload()
    await page.getByRole('heading', { name: 'Menunggu konfirmasi organizer', exact: true }).waitFor()
    assert.equal((await context.request.get(`${api}/api/me/purchases/${id}/proof`)).status(), 200)
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Saved purchase has no horizontal overflow')
    const organizer = await contextFor(f, true), dashboard = await organizer.newPage()
    dashboard.on('dialog', dialog => dialog.accept())
    await dashboard.goto(origin + '/organizer')
    await dashboard.getByRole('button', { name: 'Lihat detail transaksi ' + saved.data.reference, exact: true }).click()
    const detail = dashboard.getByRole('region', { name: 'Detail transaksi', exact: true })
    await detail.getByRole('link', { name: 'Lihat bukti pembayaran', exact: true }).waitFor()
    await detail.getByRole('button', { name: 'Terima pembayaran', exact: true }).click()
    await dashboard.getByRole('region', { name: 'Tabel peserta terkonfirmasi', exact: true }).getByText('Reward operations owner', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Perbarui status', exact: true }).click()
    await page.getByRole('heading', { name: 'Pembayaran dikonfirmasi', exact: true }).waitFor()
    await page.screenshot({ path: `/tmp/temuevent-temporary-confirmed-${f.width}.png`, fullPage: true })
    await page.getByRole('link', { name: 'Lihat dan tulis ulasan', exact: true }).click()
    await page.waitForURL(`${origin}/events/${f.eventId}/review`)
    await page.getByRole('button', { name: '4 bintang', exact: true }).click()
    const attendance = page.getByRole('checkbox', { name: 'Saya menghadiri event ini', exact: true })
    assert.equal(await attendance.isChecked(), false)
    await page.locator('#review').fill('Ulasan melalui purchase dan proof yang disimpan.')
    await page.getByRole('button', { name: 'Kirim Ulasan', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Ya, Kirim Ulasan', exact: true }).click()
    await page.getByText('Ulasan berhasil dikirim', { exact: true }).waitFor()
    await page.reload()
    await page.getByText('Kamu sudah memberikan ulasan untuk event ini.', { exact: true }).waitFor()
    assert.equal(await page.getByRole('link', { name: /pilih tiket/i }).count(), 0)
    assert.deepEqual(errors, [])
    results.push({ width: f.width, persistedCheckout: true, lostReplyRetryChecked: f.width === 1280, proofAfterReload: true, normalOrganizerDecision: true,
      participantUpdated: true, optionalAttendanceReview: true, horizontalOverflow: false })
    await organizer.close(); await context.close()
  }
  console.log(JSON.stringify({ scope: 'isolated browser -> real runtime -> disposable PostgreSQL -> real F2 decision/review', liveDatabaseUsed: false,
    storage: 'memory transport', externalEmailSent: false, ownerAcceptance: false, results }))
} catch (error) {
  await activePage?.screenshot({ path: '/tmp/temuevent-temporary-failure.png', fullPage: true }).catch(() => {})
  console.error('Checkout browser page:', await activePage?.locator('body').innerText().catch(() => 'unavailable'))
  throw error
} finally { await browser.close() }
