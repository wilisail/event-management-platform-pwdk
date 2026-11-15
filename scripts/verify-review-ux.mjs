import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const { chromium } = createRequire(new URL('../feature-2/package.json', import.meta.url))('playwright')
const origin = process.env.QA_ORIGIN || 'http://127.0.0.1:3000'
assert.equal(origin, 'http://127.0.0.1:3000', 'Isolated local browser only')
const id = '11111111-1111-4111-8111-111111111111'
const user = { id: '22222222-2222-4222-8222-222222222222', role: 'CUSTOMER', name: 'Demo Customer', email: 'demo@example.test', referralCode: 'DEMO12345678', profilePictureUrl: null }
const event = { id, title: 'Temu Kreator Jakarta', category: 'Komunitas', date: '2026-11-13T03:00:00Z', endDate: '2026-11-13T05:00:00Z', location: 'Jakarta', venue: 'Ruang Kreatif', address: '', description: 'Demo event', image: null, price: 50000, availableSeats: 39, organizerId: 'demo-organizer', organizer: 'Temu Kreator' }
const browser = await chromium.launch({ headless: true, ...(process.env.QA_CHROMIUM_PATH ? { executablePath: process.env.QA_CHROMIUM_PATH } : {}) })
const results = []
try {
  for (const width of [1280, 360, 320]) for (const checked of [false, true]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    const page = await context.newPage()
    let saved = null, reviewPosts = 0
    const unexpected = [], errors = []
    page.on('pageerror', error => errors.push(error.message))
    await context.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url()), path = url.pathname
      if (url.origin !== origin) unexpected.push(request.url())
      let data, status = 200
      if (path === '/api/me') data = user
      else if (path === '/api/auth/csrf') data = { csrfToken: 'local-review-ux-csrf' }
      else if (path === `/api/events/${id}`) data = event
      else if (path === `/api/events/${id}/reviews/eligibility`) data = saved ? { eligible: false, reason: 'ALREADY_REVIEWED' } : { eligible: true, reason: 'ELIGIBLE' }
      else if (path === `/api/events/${id}/reviews` && request.method() === 'GET') data = saved ? [saved] : []
      else if (path === `/api/events/${id}/reviews` && request.method() === 'POST') {
        reviewPosts++
        const body = request.postDataJSON()
        assert.equal(body.reportedAttendance, checked)
        assert.equal(body.userId, undefined)
        assert.equal(request.headers()['x-csrf-token'], 'local-review-ux-csrf')
        saved = { id: 'saved-review', eventId: id, userId: user.id, reviewerName: user.name, ...body, createdAt: '2026-11-15T07:00:00Z' }
        data = saved; status = 201
      } else { unexpected.push(request.method() + ' ' + path); status = 500 }
      await route.fulfill({ status, json: { success: status < 400, data } })
    })
    await page.goto(`${origin}/events/${id}`)
    await page.getByRole('link', { name: 'Lihat dan tulis ulasan', exact: true }).click()
    await page.waitForURL(`${origin}/events/${id}/review`)
    assert.equal(await page.locator('a[href$="/tickets"]').count(), 0, 'Review flow has no ticket selection link')
    const checkbox = page.getByRole('checkbox', { name: 'Saya menghadiri event ini', exact: true })
    await checkbox.waitFor()
    assert.equal(await checkbox.isChecked(), false)
    if (checked) await checkbox.check()
    await page.getByRole('button', { name: '4 bintang', exact: true }).click()
    await page.getByLabel('Ceritakan pengalamanmu').fill('Acaranya menyenangkan dan tertata dengan baik.')
    await page.getByRole('button', { name: 'Kirim Ulasan', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Ya, Kirim Ulasan', exact: true }).click()
    await page.getByRole('heading', { name: 'Ulasan berhasil dikirim', exact: true }).waitFor()
    assert.equal(reviewPosts, 1)
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No page overflow')
    await page.reload()
    await page.getByText('Kamu sudah memberikan ulasan untuk event ini.', { exact: true }).waitFor()
    assert.equal(await page.getByRole('checkbox').count(), 0)
    assert.deepEqual(unexpected, [], 'No Organizer attendance request or unexpected API call')
    assert.deepEqual(errors, [])
    results.push({ width, reportedAttendance: checked, directReviewNavigation: true, ticketSelectionRequired: false, reviewSubmitted: true, organizerCheckInRequired: false, duplicateFormHidden: true })
    await context.close()
  }
  console.log(JSON.stringify({ mode: 'isolated optional-attendance review browser', results }))
} finally { await browser.close() }
