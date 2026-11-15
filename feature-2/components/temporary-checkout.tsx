'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from './auth-provider'
import { AuthApiError } from '../lib/auth-client'
import type { CheckoutInput } from '../contracts/temporary-checkout'
import type { AccountWalletView } from '../contracts/types'

const money = (n: number) => 'Rp' + n.toLocaleString('id-ID')
const card = 'rounded-2xl border border-[#ebe7f5] bg-white p-5 shadow-sm sm:p-6'
const primary = 'rounded-xl bg-[#5148df] px-5 py-3 text-sm font-bold text-white disabled:opacity-50'
type EventChoice = { id: string; title: string; date: string; image: string | null; location: string;
  ticketTypes: { id: string; name: string; description: string; price: number; availableSeats: number }[] }

/** Temporary F2 purchase connection; root route stays a small replaceable adapter. */
export function TemporaryCheckout({ eventId }: { eventId: string }) {
  const auth = useAuth(), router = useRouter(), userId = auth.user?.role === 'CUSTOMER' ? auth.user.id : null
  const [event, setEvent] = useState<EventChoice | null>(null), [wallet, setWallet] = useState<AccountWalletView | null>(null)
  const [quantities, setQuantities] = useState<Record<string, number>>({}), [couponId, setCouponId] = useState('')
  const [points, setPoints] = useState(0), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false), [attempt, setAttempt] = useState<CheckoutInput | null>(null)
  const sending = useRef(false), active = useRef(userId)
  const dialog = useRef<HTMLDialogElement>(null)
  active.current = userId
  const key = userId ? `temuevent-checkout:${userId}:${eventId}` : ''
  useEffect(() => {
    const abort = new AbortController()
    setEvent(null); setError('')
    void fetch('/api/events/' + encodeURIComponent(eventId), { signal: abort.signal, cache: 'no-store' }).then(async response => {
      const body = await response.json()
      if (!response.ok || !body.success) throw new Error(body.message || 'Event belum dapat dimuat.')
      if (!abort.signal.aborted) setEvent(body.data)
    }).catch(reason => { if (!abort.signal.aborted) setError(reason.message) })
    return () => abort.abort()
  }, [eventId])
  useEffect(() => {
    const abort = new AbortController()
    setWallet(null); setQuantities({}); setCouponId(''); setPoints(0); setAttempt(null); setConfirming(false)
    if (!userId) return () => abort.abort()
    void auth.client.get<AccountWalletView>('/api/me/rewards?pageSize=50', abort.signal).then(value => {
      if (!abort.signal.aborted) setWallet(value)
    }).catch(reason => { if (!abort.signal.aborted) setError(reason.message) })
    // Retain only the same account's cart, never authentication data or client-supplied prices as authority.
    try {
      const raw = sessionStorage.getItem(key)
      if (raw) {
        const saved: CheckoutInput = JSON.parse(raw)
        if (saved.eventId === eventId && Array.isArray(saved.items) && /^[0-9a-f-]{36}$/i.test(saved.purchaseId)) {
          setAttempt(saved); setQuantities(Object.fromEntries(saved.items.map(i => [i.ticketTypeId, i.quantity])))
          setPoints(saved.pointsRequested); setCouponId(saved.couponId ?? '')
          void auth.client.customerPurchase(saved.purchaseId, abort.signal).then(() => {
            if (!abort.signal.aborted) { sessionStorage.removeItem(key); router.replace('/transactions/' + saved.purchaseId) }
          }).catch(() => { /* Reconnect the same idempotent attempt when the owner retries. */ })
        }
      }
    } catch { /* Browser storage is optional; the in-flight attempt still remains stable. */ }
    return () => abort.abort()
  }, [auth.client, userId, eventId, key, router])
  const coupons = wallet?.coupons.items.filter(c => c.status === 'AVAILABLE') ?? []
  const selected = event?.ticketTypes.filter(t => (quantities[t.id] ?? 0) > 0) ?? []
  const subtotal = attempt?.expectedSubtotal ?? selected.reduce((sum, t) => sum + t.price * quantities[t.id], 0)
  const couponDiscount = attempt ? Math.max(0, attempt.expectedSubtotal - attempt.expectedTotal - attempt.pointsRequested)
    : Math.min(subtotal, coupons.find(c => c.id === couponId)?.discountValue ?? 0)
  const pointsUsed = attempt?.pointsRequested ?? Math.min(points, Math.max(0, subtotal - couponDiscount))
  const total = attempt?.expectedTotal ?? subtotal - couponDiscount - pointsUsed
  useEffect(() => { if (confirming && !attempt) dialog.current?.showModal() }, [confirming, attempt])
  const ready = Boolean(userId && wallet?.userId === userId && event)
  async function submit() {
    if (!ready || !userId || sending.current) return
    const input = attempt ?? { purchaseId: crypto.randomUUID(), eventId,
      items: selected.map(t => ({ ticketTypeId: t.id, quantity: quantities[t.id] })),
      pointsRequested: pointsUsed, couponId: couponDiscount ? couponId : null, expectedSubtotal: subtotal, expectedTotal: total }
    sending.current = true; setBusy(true); setError(''); setAttempt(input)
    try { sessionStorage.setItem(key, JSON.stringify(input)) } catch { /* Optional persistence. */ }
    try {
      const result = await auth.client.createPurchase(input, userId)
      if (active.current !== userId) return
      try { sessionStorage.removeItem(key) } catch { /* Optional persistence. */ }
      router.push('/transactions/' + result.id)
    } catch (reason) {
      if (active.current !== userId) return
      setError(reason instanceof AuthApiError ? reason.message : 'Periksa pesanan sebelum mencoba kembali.')
      if (reason instanceof AuthApiError && reason.status >= 400 && reason.status < 500) {
        setAttempt(null); setConfirming(false)
        try { sessionStorage.removeItem(key) } catch { /* Optional persistence. */ }
      }
    } finally { sending.current = false; setBusy(false) }
  }
  return <main className="mx-auto max-w-5xl px-4 py-8 text-[#11103d] sm:px-6">
    <Link href={'/events/' + eventId} className="text-sm font-bold text-[#5148df]">← Kembali ke event</Link>
    <h1 className="mt-5 text-3xl font-black">Pilih tiket & periksa pesanan</h1>
    <p className="mt-2 text-sm text-[#77738b]">Tiket dan reward akan direservasi saat pesanan dibuat.</p>
    {error && <div role="alert" className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-800"><p>{error}</p><button type="button" onClick={() => window.location.reload()} className="mt-2 font-bold underline">Perbarui tiket & saldo</button></div>}
    {auth.status === 'loading' && <p role="status" className="mt-4">Memeriksa akun…</p>}
    {auth.status === 'error' && <p role="alert" className="mt-4">{auth.error} <Link href="/login" className="underline">Masuk ulang</Link></p>}
    {auth.status === 'anonymous' && <p className="mt-4 rounded-xl bg-[#f2edff] p-4">Masuk sebagai customer untuk membeli tiket. <Link className="font-bold underline" href={'/login?next=' + encodeURIComponent('/events/' + eventId + '/tickets')}>Masuk untuk membeli</Link></p>}
    {auth.user?.role === 'ORGANIZER' && <p role="alert" className="mt-4 rounded-xl bg-[#f2edff] p-4">Pembelian menggunakan akun customer. <Link href="/organizer" className="font-bold underline">Kembali ke dashboard organizer</Link></p>}
    {!event && !error && <p className="mt-6" role="status">Memuat event…</p>}
    {event && <div className="mt-6 grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0 space-y-5">
        <div className={card}><h2 className="text-xl font-black">{event.title}</h2>
          <p className="mt-2 text-sm text-[#77738b]">{new Date(event.date).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'long', timeStyle: 'short' })} WIB · {event.location}</p>
          {event.image && <img src={event.image} alt={event.title} className="mt-4 h-40 w-full rounded-xl object-cover" />}</div>
        <fieldset disabled={busy || Boolean(attempt)} className={card + ' min-w-0 space-y-5'}><legend className="px-1 text-lg font-black">Pilihan tiket</legend>
          {event.ticketTypes.map(ticket => <div key={ticket.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee9fb] pb-4 last:border-0">
            <div className="min-w-0"><h3 className="font-bold">{ticket.name}</h3><p className="mt-1 text-xs text-[#77738b]">{ticket.description}</p><p className="mt-2 text-sm font-bold">{money(ticket.price)} · Tersedia {ticket.availableSeats} tiket</p></div>
            <div className="flex items-center gap-3"><button type="button" aria-label={'Kurangi ' + ticket.name} disabled={!quantities[ticket.id]} onClick={() => setQuantities(q => ({ ...q, [ticket.id]: Math.max(0, (q[ticket.id] ?? 0) - 1) }))} className="h-10 w-10 rounded-lg border disabled:opacity-40">−</button>
              <span className="min-w-5 text-center font-bold">{quantities[ticket.id] ?? 0}</span>
              <button type="button" aria-label={'Tambah ' + ticket.name} disabled={(quantities[ticket.id] ?? 0) >= Math.min(20, ticket.availableSeats)} onClick={() => setQuantities(q => ({ ...q, [ticket.id]: Math.min(20, ticket.availableSeats, (q[ticket.id] ?? 0) + 1) }))} className="h-10 w-10 rounded-lg border disabled:opacity-40">+</button></div>
          </div>)}</fieldset>
        {ready && <fieldset disabled={busy || Boolean(attempt)} className={card + ' min-w-0 space-y-4'}><legend className="px-1 text-lg font-black">Poin & kupon referral</legend>
          <label className="block text-sm font-bold">Kupon referral<select aria-label="Kupon referral" value={couponId} onChange={e => setCouponId(e.target.value)} className="mt-2 block w-full max-w-full rounded-xl border p-3 font-normal"><option value="">Tanpa kupon</option>{coupons.map(c => <option value={c.id} key={c.id}>{c.code} · {money(c.discountValue)}</option>)}</select></label>
          <label className="block text-sm font-bold">Poin yang digunakan<input aria-label="Poin yang digunakan" type="number" min={0} max={wallet!.availablePoints} value={points} onChange={e => setPoints(Math.min(wallet!.availablePoints, Math.max(0, Math.floor(Number(e.target.value) || 0))))} className="mt-2 block w-full rounded-xl border p-3 font-normal" /></label>
          <p className="text-xs text-[#77738b]">Saldo tersedia: {wallet!.availablePoints.toLocaleString('id-ID')} poin. 1 poin = Rp1.</p></fieldset>}
      </section>
      <aside className={card + ' min-w-0'}><h2 className="text-lg font-black">Ringkasan pesanan</h2>
        <div className="mt-4 space-y-3 text-sm">{selected.map(t => <p key={t.id} className="flex justify-between gap-3"><span>{t.name} × {quantities[t.id]}</span><strong>{money(t.price * quantities[t.id])}</strong></p>)}
          <p className="flex justify-between gap-3"><span>Subtotal</span><strong>{money(subtotal)}</strong></p>
          <p className="flex justify-between gap-3"><span>Kupon referral</span><strong>−{money(couponDiscount)}</strong></p>
          <p className="flex justify-between gap-3"><span>Poin</span><strong>−{money(pointsUsed)}</strong></p>
          <p className="flex justify-between gap-3 border-t pt-4 text-lg font-black"><span>Total</span><span>{money(total)}</span></p></div>
        <button type="button" disabled={!ready || !selected.length || busy || Boolean(attempt)} className={primary + ' mt-6 w-full'} onClick={() => { setError(''); setConfirming(true) }}>Periksa pesanan</button>
        {attempt && <div className="mt-4 space-y-3 text-sm"><p>Pesanan sedang disambungkan. Gunakan percobaan yang sama agar tidak membuat pesanan ganda.</p><Link className="block font-bold text-[#5148df]" href={'/transactions/' + attempt.purchaseId}>Periksa status pesanan</Link><button type="button" className={primary + ' w-full'} disabled={busy} onClick={() => void submit()}>{busy ? 'Menyimpan…' : 'Sambungkan pesanan kembali'}</button></div>}
      </aside>
    </div>}
    {confirming && !attempt && <dialog ref={dialog} onCancel={() => setConfirming(false)} aria-labelledby="checkout-confirm-title" className={card + ' m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto backdrop:bg-black/40'}><h2 id="checkout-confirm-title" className="text-xl font-black">Konfirmasi pesanan</h2>
        <p className="mt-3 text-sm">{selected.map(t => `${t.name} × ${quantities[t.id]}`).join(', ')}</p><p className="mt-4 text-xl font-black">{money(total)}</p><p className="mt-3 text-sm text-[#77738b]">Setelah disimpan, pesanan berbayar memiliki batas unggah bukti 2 jam. Pesanan Rp0 langsung dikonfirmasi.</p>
        <div className="mt-6 flex flex-wrap gap-3"><button autoFocus type="button" className="rounded-xl border px-5 py-3 text-sm font-bold" onClick={() => setConfirming(false)}>Kembali</button><button type="button" className={primary} disabled={busy} onClick={() => void submit()}>Buat pesanan</button></div>
    </dialog>}
  </main>
}
