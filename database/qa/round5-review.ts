/** Loopback-only review tooling. This module is never mounted by the real application. */
import type { createApp } from '../../feature-2/server/app'
import type { PrismaClient } from '../../feature-2/generated/prisma/client'
import type { EmailMessage } from '../../feature-2/server/email/resend'
import { requireAuthentication, authentication } from '../../feature-2/server/auth/authorization'
import { loginFields, type sessionFixture } from '../../feature-2/tests/helpers/sessions'

type Express = ReturnType<typeof createApp>
type Fixture = { purchaseId: string; owner: { id: string; email: string }; organizer: { id: string; email: string } }
export function installRound5Review(app: Express, options: {
  auth: ReturnType<typeof sessionFixture>; db: PrismaClient; accept: Fixture; reject: Fixture;
  delivered: Map<string, EmailMessage>; webOrigin: string
}) {
  const { auth, db, accept, reject, delivered, webOrigin } = options
  const target = new URL(webOrigin)
  if (target.hostname !== '127.0.0.1' || target.protocol !== 'http:' || target.pathname !== '/') throw new Error('Review web origin must be loopback')
  const personas = new Map([['organizer', accept.organizer], ['buyer-accept', accept.owner], ['buyer-reject', reject.owner]])
  app.use('/qa', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  app.post('/api/qa/enter/:persona', async (req, res) => {
    // No user credentials or shared environment are used. Only these disposable fixture identities exist here.
    const origin = req.get('origin')
    if (req.get('x-temuevent-client') !== 'web' || req.get('sec-fetch-site') === 'cross-site' ||
      origin && origin !== `http://${req.get('host')}` && origin !== target.origin) { res.sendStatus(403); return }
    const user = personas.get(String(req.params.persona))
    if (!user) { res.sendStatus(404); return }
    const credential = await auth.service.login({ ...loginFields, email: user.email })
    const cookie = { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: false }
    res.cookie('temuevent_access', credential.accessToken, { ...cookie, maxAge: +credential.accessExpiresAt - +auth.now() })
    res.cookie('temuevent_refresh', credential.refreshToken, { ...cookie, maxAge: +credential.sessionExpiresAt - +auth.now() })
    res.set('Cache-Control', 'no-store').json({ success: true, data: {
      redirect: req.params.persona === 'organizer' ? target.origin + '/organizer' : '/qa',
    } })
  })
  app.get('/api/qa/overview', requireAuthentication(auth.service, false), async (_req, res) => {
    const user = authentication(res)!.user
    const records = await db.purchase.findMany({ where: {
      id: { in: [accept.purchaseId, reject.purchaseId] },
      ...(user.role === 'ORGANIZER' ? { event: { organizerId: user.id } } : { customerId: user.id }),
    }, select: { reference: true, status: true, totalPrice: true, event: { select: { name: true } } } })
    res.json({ success: true, data: { role: user.role,
      purchases: records.map(p => ({ reference: p.reference, status: p.status, totalPrice: Number(p.totalPrice), event: p.event.name })),
      capturedMessages: [...delivered.values()].filter(m => m.to === user.email).map(m => ({ subject: m.subject, text: m.text })),
    } })
  })
  app.get('/qa', (_req, res) => res.type('html').send(`<!doctype html><html lang="id"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>TemuEvent · Round 5 QA</title>
<style>body{font:16px system-ui;background:#f7f5ff;color:#241d40;margin:0;padding:32px}main{max-width:960px;margin:auto}section{background:white;border:1px solid #e7e1f2;border-radius:18px;padding:24px;margin:20px 0}h1{font-size:32px}button,a{font:inherit}button{background:#5749dc;color:white;border:0;border-radius:10px;padding:12px 18px;margin:6px;cursor:pointer}a{color:#5142c7}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f8f6ff;padding:16px;border-radius:12px}.note{border-left:5px solid #27b3b7;padding-left:16px}</style>
<main><p>TemuEvent · lingkungan QA terisolasi</p><h1>Round 5 siap diperiksa</h1>
<p class="note">Semua akun, transaksi dan bukti di sini adalah data uji sementara. Keputusan memakai adapter QA; email ditangkap lokal. Tidak ada pembayaran atau email keluar. Aplikasi bersama dan event 4A/4B tetap terpisah.</p>
<section><h2>1. Periksa sebagai organizer</h2><p>Buka detail <strong>Round 5 — Terima pembayaran</strong>, lihat bukti privat, lalu terima. Untuk <strong>Round 5 — Tolak pembayaran</strong>, lihat bukti lalu tolak.</p>
<button data-persona="organizer">Buka dashboard Organizer QA</button></section>
<section><h2>2. Periksa hasil sebagai pembeli</h2><p>Pilih pembeli, lalu periksa status, saldo/kupon dan pesan yang ditangkap. Tombol perbarui hanya membaca data.</p>
<button data-persona="buyer-accept">Pembeli — diterima</button><button data-persona="buyer-reject">Pembeli — ditolak</button><button id="refresh">Perbarui hasil</button>
<pre id="result">Pilih akun QA untuk memulai.</pre></section><p><a href="${target.origin}/organizer">Dashboard Organizer</a> · <a href="/qa">Kembali ke alat QA</a></p></main>
<script>const out=document.querySelector('#result');async function refresh(){try{const r=await fetch('/api/qa/overview');const d=await r.json();if(!r.ok){out.textContent='Pilih akun QA terlebih dahulu.';return}let wallet=null;if(d.data.role==='CUSTOMER'){const w=await fetch('/api/me/rewards');const v=await w.json();if(w.ok)wallet={poinTersedia:v.data.availablePoints,kuponTersedia:v.data.availableCouponCount}}out.textContent=JSON.stringify({akun:d.data.role,transaksi:d.data.purchases,dompet:wallet,emailTertangkap:d.data.capturedMessages},null,2)}catch{out.textContent='Hasil belum tersedia. Coba perbarui.'}}document.querySelectorAll('[data-persona]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;try{const r=await fetch('/api/qa/enter/'+b.dataset.persona,{method:'POST',headers:{'x-temuevent-client':'web'}});const d=await r.json();if(!r.ok)throw Error();location.assign(d.data.redirect)}catch{out.textContent='Akun QA belum dapat dibuka.';b.disabled=false}}));document.querySelector('#refresh').addEventListener('click',refresh);refresh();</script></html>`))
}
