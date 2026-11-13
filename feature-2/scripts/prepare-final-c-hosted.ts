import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { z } from 'zod'
import { databaseClient, disconnectDatabase } from '../server/database'
import { hashPassword } from '../server/auth/passwords'
import { customerRewards } from '../server/rewards/operations'

// Maintenance utility only. It is not imported by a normal application bootstrap or API route.
const parameters = z.object({ runId: z.uuid(), organizerId: z.uuid(), pointsCustomerId: z.uuid(),
  couponCustomerId: z.uuid(), expiresAt: z.iso.datetime() }).strict()
export const finalCPhases = ['seed', 'reserve', 'upload', 'verify-reads', 'verify-decisions',
  'verify-deadlines', 'remove-temporary-files', 'handoff'] as const
export type FinalCPhase = typeof finalCPhases[number]
const origin = 'https://temuevent-combined-qa-andor2.vercel.app'

function settings() {
  if (process.env.VERCEL_ENV !== 'preview') throw new Error('Preview only')
  const p = parameters.parse(JSON.parse(process.env.TEMUEVENT_C_PARAMETERS || '{}'))
  if (+new Date(p.expiresAt) <= Date.now()) throw new Error('Preparation window has ended')
  const secret = process.env.AUTH_JWT_SECRET
  if (!secret || !process.env.SUPABASE_SECRET_KEY ||
    new URL(process.env.SUPABASE_URL || '').origin !== 'https://rjjwjacihxepticquxxa.supabase.co') throw new Error('Missing project settings')
  const tag = p.runId.slice(0, 8)
  const id = (label: string) => {
    const bytes = createHash('sha256').update(p.runId + ':' + label).digest().subarray(0, 16)
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128
    const s = bytes.toString('hex')
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`
  }
  const actors = ['buyer-a', 'buyer-b', 'sponsor', 'friend-a', 'friend-b', 'organizer', 'other-organizer']
    .map(label => ({ id: id('user-' + label), label, email: `final-c-${tag}-${label}@example.test`,
      role: label.includes('organizer') ? 'ORGANIZER' as const : 'CUSTOMER' as const }))
  const password = createHmac('sha256', secret).update('final-c:' + p.runId).digest('base64url')
  return { ...p, tag, id, actors, password }
}

function apiAccess() {
  const platformCookies = new Map<string, string>()
  const capture = (response: Response, jar: Map<string, string>) => {
    for (const header of response.headers.getSetCookie()) {
      const pair = header.split(';', 1)[0], at = pair.indexOf('=')
      jar.set(pair.slice(0, at), pair.slice(at + 1))
    }
  }
  const cookieHeader = (jar: Map<string, string>) => [...jar].map(([k, v]) => k + '=' + v).join('; ')
  const enter = async () => {
    let target = new URL(process.env.TEMUEVENT_C_TARGET_SHARE_URL || '')
    assert.equal(target.origin, origin); assert(target.searchParams.has('_vercel_share'))
    for (let attempt = 0; attempt < 6; attempt++) {
      const response = await fetch(target, { headers: { cookie: cookieHeader(platformCookies) },
        redirect: 'manual', signal: AbortSignal.timeout(20000) })
      capture(response, platformCookies); await response.body?.cancel()
      if (response.status >= 300 && response.status < 400) {
        target = new URL(response.headers.get('location')!, target); assert.equal(target.origin, origin)
      } else { assert.equal(response.status, 200); return }
    }
    throw new Error('Platform access did not complete')
  }
  type Login = { cookies: Map<string, string>; csrf: string }
  const request = async (path: string, options: { login?: Login; body?: unknown; method?: string; worker?: boolean } = {}) => {
    assert(path.startsWith('/api/'))
    const cookies = new Map([...platformCookies, ...(options.login?.cookies ?? [])])
    const response = await fetch(origin + path, { method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
      headers: { cookie: cookieHeader(cookies), origin,
        ...(options.body === undefined ? {} : { 'content-type': 'application/json', 'x-temuevent-client': 'web' }),
        ...(options.login ? { 'x-csrf-token': options.login.csrf } : {}),
        ...(options.worker ? { authorization: 'Bearer ' + process.env.F2_JOB_RUNNER_SECRET } : {}) },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      redirect: 'manual', signal: AbortSignal.timeout(25000) })
    const bytes = Buffer.from(await response.arrayBuffer())
    let json: any
    try { json = JSON.parse(bytes.toString('utf8')) } catch {}
    return { response, status: response.status, bytes, json }
  }
  const login = async (email: string, password: string): Promise<Login> => {
    const result = await request('/api/auth/login', { body: { email, password } })
    assert.equal(result.status, 200)
    const cookies = new Map<string, string>(); capture(result.response, cookies)
    assert.equal(typeof result.json?.data?.csrfToken, 'string')
    return { cookies, csrf: result.json.data.csrfToken }
  }
  return { enter, request, login }
}

export async function prepareFinalCHosted(phase: FinalCPhase) {
  assert(finalCPhases.includes(phase))
  const p = settings(), db = databaseClient(), at = new Date()
  const storage = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }).storage.from('payment-proofs')
  const actor = (label: string) => p.actors.find(x => x.label === label)!
  const autoCases = ['accept', 'reject', 'expire', 'cancel']
  const manualCases = ['manual-accept', 'manual-reject']
  const allCases = [...autoCases, ...manualCases]
  const key = (label: string) => `final-c/${p.runId}/${p.id('purchase-' + label)}.png`
  const check = (condition: unknown, message: string) => assert(condition, message)
  try {
    if (phase === 'seed') {
      const [organizer, customer, referred] = await Promise.all([
        db.user.findUniqueOrThrow({ where: { id: p.organizerId } }),
        db.user.findUniqueOrThrow({ where: { id: p.pointsCustomerId } }),
        db.user.findUniqueOrThrow({ where: { id: p.couponCustomerId } }),
      ])
      check(organizer.role === 'ORGANIZER' && customer.role === 'CUSTOMER' && referred.role === 'CUSTOMER', 'Manual account roles')
      check([organizer, customer, referred].every(x => x.passwordHash && x.email.endsWith('@gmail.com')), 'Expected existing acceptance accounts')
      const passwordHash = await hashPassword(p.password)
      await db.$transaction(async tx => {
        await tx.user.createMany({ data: p.actors.map(a => ({ id: a.id, email: a.email, name: 'QA C ' + a.label,
          role: a.role, passwordHash, referralCode: p.id(a.label).replaceAll('-', '').slice(0, 16).toUpperCase() })), skipDuplicates: true })
        for (const label of ['a', 'b']) {
          const buyer = actor('buyer-' + label), friend = actor('friend-' + label)
          await tx.referral.createMany({ data: [
            { id: p.id('incoming-' + label), referrerId: actor('sponsor').id, referredUserId: buyer.id },
            { id: p.id('outgoing-' + label), referrerId: buyer.id, referredUserId: friend.id },
          ], skipDuplicates: true })
          await tx.rewardCoupon.createMany({ data: { id: p.id('coupon-' + label), referralId: p.id('incoming-' + label),
            userId: buyer.id, code: 'C-' + p.tag + '-' + label, discountValue: 25000n,
            issuedAt: new Date(+at - 60000), expiresAt: new Date(+at + 90 * 86400000) }, skipDuplicates: true })
          await tx.pointGrant.createMany({ data: { id: p.id('grant-' + label), referralId: p.id('outgoing-' + label),
            userId: buyer.id, amount: 10000n, remainingAmount: 10000n, creditedAt: new Date(+at - 60000),
            expiresAt: new Date(+at + 90 * 86400000) }, skipDuplicates: true })
        }
        for (const manual of [false, true]) {
          const suffix = manual ? 'manual' : 'auto'
          await tx.event.createMany({ data: { id: p.id('event-' + suffix),
            organizerId: manual ? p.organizerId : actor('organizer').id,
            slug: 'qa-c-' + suffix + '-' + p.tag,
            name: manual ? 'QA F2 - Persetujuan dan Kehadiran' : 'QA C temporary verification',
            category: 'Learning', location: 'Jakarta', venue: 'Lingkungan uji',
            description: 'Data uji integrasi. Tidak ada pembayaran atau transfer uang nyata.',
            startAt: new Date(+at - 7200000), endAt: new Date(+at - 3600000), status: 'PUBLISHED' }, skipDuplicates: true })
          await tx.ticketType.createMany({ data: { id: p.id('ticket-' + suffix), eventId: p.id('event-' + suffix),
            name: 'Tiket uji', price: 50000n, quota: 40, availableSeats: 40 }, skipDuplicates: true })
        }
      }, { timeout: 20000 })
      return { phase, passed: true, temporaryAccounts: p.actors.length, manualAccountsUnchanged: true }
    }
    if (phase === 'reserve') {
      for (const label of allCases) {
        const manual = label.startsWith('manual'), suffix = manual ? 'manual' : 'auto'
        const customerId = label === 'manual-accept' ? p.pointsCustomerId : label === 'manual-reject' ? p.couponCustomerId
          : label === 'reject' ? actor('buyer-b').id : actor('buyer-a').id
        const existing = await db.purchase.findUnique({ where: { id: p.id('purchase-' + label) }, include: { rewardRedemption: true } })
        const coupon = label === 'manual-reject' && !existing ? await db.rewardCoupon.findFirst({ where: { userId: customerId,
          expiresAt: { gt: at }, redemptions: { none: { status: { in: ['RESERVED', 'CONSUMED'] } } } }, orderBy: { issuedAt: 'asc' } }) : null
        const pointsRequested = ['accept', 'reject', 'manual-accept'].includes(label) ? 5000 : 0
        const couponId = label === 'accept' ? p.id('coupon-a') : label === 'reject' ? p.id('coupon-b') : existing?.rewardRedemption?.couponId ?? coupon?.id
        if (label === 'manual-reject') check(couponId, 'An unused referred-customer coupon is required')
        await db.$transaction(async tx => {
          const rewards = await customerRewards(tx, customerId)
          const purchaseId = p.id('purchase-' + label)
          await rewards.reserveNewPurchase({ purchaseId, subtotal: 50000, voucherDiscount: 0, pointsRequested, couponId }, async quote => {
            const held = await tx.ticketType.updateMany({ where: { id: p.id('ticket-' + suffix), availableSeats: { gte: 1 } },
              data: { availableSeats: { decrement: 1 } } })
            check(held.count === 1, 'Seat reservation')
            const proof = label !== 'expire'
            await tx.purchase.create({ data: { id: purchaseId, reference: 'C-' + label.toUpperCase() + '-' + p.tag,
              customerId, eventId: p.id('event-' + suffix), status: proof ? 'WAITING_FOR_ADMIN_CONFIRMATION' : 'WAITING_FOR_PAYMENT',
              subtotal: 50000n, voucherDiscount: 0n, couponDiscount: BigInt(quote.couponDiscount),
              pointsUsed: BigInt(quote.pointsUsed), totalPrice: BigInt(quote.totalPrice),
              paymentDueAt: new Date(+at + 7200000), ...(proof ? { paymentProofKey: key(label), proofUploadedAt: at,
                decisionDueAt: new Date(+at + 3 * 86400000) } : {}) } })
            await tx.purchaseItem.create({ data: { id: p.id('item-' + label), purchaseId,
              eventId: p.id('event-' + suffix), ticketTypeId: p.id('ticket-' + suffix),
              quantity: 1, unitPrice: 50000n, lineTotal: 50000n } })
          })
        }, { timeout: 20000 })
      }
      return { phase, passed: true, temporaryPurchases: 4, manualPurchases: 2 }
    }
    if (phase === 'upload') {
      const result = await Promise.all(allCases.filter(x => x !== 'expire').map(async label => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="480"><rect width="900" height="480" fill="#f7f5ff"/><rect x="25" y="25" width="850" height="430" rx="20" fill="white" stroke="#5749dc"/><text x="65" y="95" font-size="30" font-family="sans-serif" fill="#5749dc">TemuEvent - BUKTI PEMBAYARAN UJI</text><text x="65" y="170" font-size="26" font-family="sans-serif">C-${label.toUpperCase()}-${p.tag}</text><text x="65" y="245" font-size="28" font-family="sans-serif" fill="#c23735">TIDAK ADA UANG DITRANSFER</text><text x="65" y="310" font-size="22" font-family="sans-serif">Dokumen simulasi untuk pengujian integrasi F2.</text><text x="65" y="370" font-size="22" font-family="sans-serif">Bukan bukti transfer bank atau pembayaran nyata.</text></svg>`
        const bytes = await sharp(Buffer.from(svg)).png().toBuffer()
        const existing = await storage.download(key(label))
        if (!existing.error && existing.data) return { label, retained: true }
        const uploaded = await storage.upload(key(label), bytes, { contentType: 'image/png', cacheControl: '0', upsert: false })
        if (uploaded.error) throw new Error('Private test proof upload failed')
        return { label, uploaded: true, bytes: bytes.length }
      }))
      return { phase, passed: true, objects: result }
    }
    if (phase === 'remove-temporary-files') {
      const result = await storage.remove(autoCases.filter(x => x !== 'expire').map(key))
      if (result.error) throw new Error('Temporary proof cleanup failed')
      return { phase, passed: true }
    }
    if (phase === 'handoff') {
      const rows = await db.purchase.findMany({ where: { id: { in: manualCases.map(x => p.id('purchase-' + x)) } },
        select: { id: true, reference: true, status: true, pointsUsed: true, couponDiscount: true, totalPrice: true, decisionDueAt: true } })
      check(rows.length === 2 && rows.every(x => x.status === 'WAITING_FOR_ADMIN_CONFIRMATION'), 'Manual purchases remain available')
      return { phase, passed: true, eventId: p.id('event-manual'), eventUrl: origin + '/events/' + p.id('event-manual'),
        organizerUrl: origin + '/organizer', purchases: rows.map(x => ({ ...x, pointsUsed: Number(x.pointsUsed),
          couponDiscount: Number(x.couponDiscount), totalPrice: Number(x.totalPrice), proofUrl: origin + '/api/organizer/transactions/' + x.id + '/proof' })),
        temporaryCleanup: { users: p.actors.map(x => ({ id: x.id, email: x.email })), eventId: p.id('event-auto'),
          purchaseIds: autoCases.map(x => p.id('purchase-' + x)) } }
    }
    const api = apiAccess(); await api.enter()
    const organizer = await api.login(actor('organizer').email, p.password)
    if (phase === 'verify-reads') {
      const buyer = await api.login(actor('buyer-a').email, p.password)
      const other = await api.login(actor('other-organizer').email, p.password)
      const path = '/api/organizer/transactions/' + p.id('purchase-accept')
      check((await api.request(path + '/proof')).status === 401, 'Signed-out proof denial')
      check((await api.request(path + '/proof', { login: buyer })).status === 403, 'Customer proof denial')
      check((await api.request(path + '/proof', { login: other })).status === 404, 'Foreign Organizer proof denial')
      const proof = await api.request(path + '/proof', { login: organizer })
      check(proof.status === 200 && proof.bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Owned private PNG')
      check(proof.response.headers.get('cache-control') === 'private, no-store', 'Private cache boundary')
      const detail = await api.request(path, { login: organizer })
      check(detail.json?.data?.decisionAvailability === 'READY', 'Live decision binding')
      return { phase, passed: true, checks: ['Real owned private PNG read', 'Signed-out/Customer/foreign-owner denials', 'Ready decision control'], proofBytes: proof.bytes.length }
    }
    if (phase === 'verify-decisions') {
      if (new Date().getUTCSeconds() > 42) return { phase, passed: false, retryAfter: 20 }
      for (const [label, decision, status] of [['accept', 'ACCEPT', 'DONE'], ['reject', 'REJECT', 'REJECTED']] as const) {
        const purchaseId = p.id('purchase-' + label)
        const before = await db.purchase.findUniqueOrThrow({ where: { id: purchaseId } })
        if (before.status !== status) {
          const result = await api.request('/api/organizer/transactions/' + purchaseId + '/decision', { login: organizer, body: { decision } })
          check(result.status === 200, 'Live decision ' + decision)
        }
        // Keep disposable example.test notifications queued for inspection, outside external transport.
        await db.organizerDecisionEmail.updateMany({ where: { purchaseId, recipientEmail: { endsWith: '@example.test' }, deliveryState: 'PENDING' },
          data: { nextAttemptAt: new Date(Date.now() + 86400000) } })
        const row = await db.purchase.findUniqueOrThrow({ where: { id: purchaseId }, include: { rewardRedemption: true, decisionEmail: true } })
        check(row.status === status && row.rewardRedemption?.status === (decision === 'ACCEPT' ? 'CONSUMED' : 'RESTORED'), 'Persisted reward outcome')
        check(row.decisionEmail?.decision === decision && row.decisionEmail.attemptCount === 0, 'Notification queued without transport')
        check((await api.request('/api/organizer/transactions/' + purchaseId + '/decision', { login: organizer, body: { decision } })).status === 409, 'Duplicate decision prevented')
      }
      const buyer = await api.login(actor('buyer-a').email, p.password)
      const eventId = p.id('event-auto'), customerId = actor('buyer-a').id, transactionId = p.id('purchase-accept')
      const mark = await api.request('/api/organizer/events/' + eventId + '/attendance', { login: organizer, body: { customerId, transactionId } })
      check(mark.status === 200 || mark.status === 201, 'Live attendance')
      const eligibility = await api.request('/api/events/' + eventId + '/reviews/eligibility', { login: buyer })
      check(eligibility.json?.data?.eligible === true, 'Attendance-gated review eligibility')
      const review = await api.request('/api/events/' + eventId + '/reviews', { login: buyer, body: { rating: 5, comment: 'Ulasan uji integrasi sementara.' } })
      check(review.status === 200 || review.status === 201, 'Persisted review')
      const duplicate = await api.request('/api/events/' + eventId + '/reviews', { login: buyer, body: { rating: 5, comment: 'Duplikat harus ditolak.' } })
      check(duplicate.status === 409, 'Duplicate review prevented')
      return { phase, passed: true, checks: ['Live approve/reject with points/coupons', 'One durable outbox row per decision; no email sent', 'Duplicate decisions denied', 'Attendance and persisted review; duplicate denied'] }
    }
    if (phase === 'verify-deadlines') {
      await db.purchase.updateMany({ where: { id: p.id('purchase-expire'), status: 'WAITING_FOR_PAYMENT' }, data: { paymentDueAt: new Date(Date.now() - 1000) } })
      await db.purchase.updateMany({ where: { id: p.id('purchase-cancel'), status: 'WAITING_FOR_ADMIN_CONFIRMATION' }, data: { decisionDueAt: new Date(Date.now() - 1000) } })
      const response = await api.request('/api/internal/jobs/run', { method: 'POST', worker: true })
      check(response.status === 200 && response.json?.purchaseDeadlines === true, 'Live scheduled deadline dispatcher')
      for (const [label, status] of [['expire', 'EXPIRED'], ['cancel', 'CANCELED']]) {
        check((await db.purchase.findUniqueOrThrow({ where: { id: p.id('purchase-' + label) } })).status === status, 'Live deadline ' + status)
      }
      const ticket = await db.ticketType.findUniqueOrThrow({ where: { id: p.id('ticket-auto') } })
      check(ticket.availableSeats === 39, 'Exactly one retained confirmed seat')
      return { phase, passed: true, checks: ['Real worker expiry/cancellation', 'Seats restored exactly once'] }
    }
    throw new Error('Unknown verification phase')
  } finally { await disconnectDatabase() }
}
