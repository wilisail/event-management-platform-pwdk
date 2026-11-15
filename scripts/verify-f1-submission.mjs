import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const { chromium } = createRequire(new URL('../feature-2/package.json', import.meta.url))('playwright')
const origin = process.env.QA_ORIGIN || 'http://127.0.0.1:3000'
assert.equal(origin, 'http://127.0.0.1:3000', 'Local isolated preview checks only')
const id = '11111111-1111-4111-8111-111111111111'
const event = {
  id, title: 'QA F1 Ticket Selection', category: 'Learning', date: '2027-01-01T03:00:00Z', endDate: '2027-01-01T05:00:00Z',
  location: 'Jakarta', venue: 'QA', address: null, description: 'Isolated API fixture', image: null,
  price: 75000, availableSeats: 3, organizerId: 'qa-owner', organizer: 'QA Organizer',
  ticketTypes: [
    { id: 'regular', name: 'QA Regular', description: 'Entry', price: 75000, quota: 10, availableSeats: 2 },
    { id: 'workshop', name: 'QA Workshop', description: 'Workshop', price: 125000, quota: 4, availableSeats: 1 },
  ],
}
const browser = await chromium.launch({ headless: true,
  ...(process.env.QA_CHROMIUM_PATH ? { executablePath: process.env.QA_CHROMIUM_PATH } : {}),
})
const results = []
try {
  for (const width of [1280, 360, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    const page = await context.newPage()
    const unexpected = [], errors = [], writes = []
    let detailReads = 0
    page.on('pageerror', error => errors.push(error.message))
    await context.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url())
      if (request.method() !== 'GET') writes.push(request.method() + ' ' + url.pathname)
      if (url.origin !== origin) unexpected.push(request.url())
      if (url.pathname === `/api/events/${id}`) {
        detailReads++
        return route.fulfill({ json: { success: true, data: event } })
      }
      if (['/api/me', '/api/auth/csrf'].includes(url.pathname)) return route.fulfill({ status: 401, json: { success: false, code: 'UNAUTHORIZED' } })
      unexpected.push(url.pathname)
      return route.fulfill({ status: 500, json: { success: false } })
    })
    await page.goto(`${origin}/events/${id}/tickets`)
    await page.getByRole('heading', { name: 'Pilih tiket & periksa pesanan' }).waitFor()
    await page.getByText('QA F1 Ticket Selection', { exact: true }).waitFor()
    assert.equal(detailReads, 1)
    await page.getByRole('button', { name: 'Lihat pratinjau pembayaran', exact: true }).click()
    await page.getByText('Pilih minimal satu tiket untuk melanjutkan.', { exact: true }).waitFor()
    const plus = page.getByRole('button', { name: 'Tambah QA Regular', exact: true })
    await plus.click(); await plus.click(); await plus.click()
    await page.getByRole('button', { name: 'Lihat pratinjau pembayaran', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByText('QA Regular × 2', { exact: true }).waitFor()
    await dialog.getByRole('button', { name: 'Konfirmasi', exact: true }).click()
    await page.getByRole('heading', { name: 'Instruksi pembayaran', exact: true }).waitFor()
    await page.getByRole('link', { name: 'Lihat contoh status transaksi', exact: true }).click()
    await page.waitForURL(`${origin}/transactions/preview`)
    await page.getByRole('note').getByText('Pratinjau transaksi dengan data contoh.', { exact: false }).waitFor()
    await page.getByLabel('Pilih contoh bukti pembayaran').setInputFiles({ name: 'qa-proof.png', mimeType: 'image/png', buffer: Buffer.from('local-preview-only') })
    await page.getByRole('button', { name: 'Kirim bukti pembayaran', exact: true }).click()
    await page.getByRole('heading', { name: 'Bukti pembayaran sedang diverifikasi', exact: true }).waitFor()
    for (const status of ['DONE', 'REJECTED', 'EXPIRED', 'CANCELED']) {
      await page.getByLabel('Pratinjau status transaksi').selectOption(status)
    }
    await page.reload()
    await page.getByRole('heading', { name: 'Menunggu pembayaran', exact: true }).waitFor()
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No transaction overflow')
    await page.screenshot({ path: `/tmp/temuevent-f1-transaction-${width}.png`, fullPage: true })
    assert.deepEqual(writes, [], 'Preview must not mutate a purchase or proof')
    assert.deepEqual(unexpected, [])
    assert.deepEqual(errors, [])
    results.push({ width, sameOriginEventRead: true, ticketSeatCap: true, previewOnly: true, persistedWrites: 0, overflow: false })
    await context.close()
  }
  console.log(JSON.stringify({ mode: 'isolated local browser with API fixtures', results }))
} finally { await browser.close() }
