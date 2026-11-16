'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './auth-provider'
import type { CustomerPurchase } from '../contracts/temporary-checkout'

const money = (n: number) => 'Rp' + n.toLocaleString('id-ID')
const date = (value: string) => new Date(value).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }) + ' WIB'
const card = 'rounded-2xl border border-[#ebe7f5] bg-white p-5 shadow-sm sm:p-6'
const primary = 'inline-block rounded-xl bg-[#5148df] px-5 py-3 text-sm font-bold text-white disabled:opacity-50'
const labels: Record<CustomerPurchase['status'], string> = {
  WAITING_FOR_PAYMENT: 'Menunggu pembayaran', WAITING_FOR_ADMIN_CONFIRMATION: 'Menunggu konfirmasi organizer',
  DONE: 'Pembayaran dikonfirmasi', REJECTED: 'Pembayaran ditolak', EXPIRED: 'Pembayaran kedaluwarsa', CANCELED: 'Pesanan dibatalkan',
}
function Access({ path }: { path: string }) {
  const auth = useAuth()
  if (auth.status === 'loading') return <p role="status" className="mt-6">Memeriksa akun…</p>
  if (auth.status === 'error') return <p role="alert" className="mt-6">{auth.error} <Link href="/login" className="underline">Masuk ulang</Link></p>
  if (!auth.user) return <p className="mt-6">Masuk untuk melihat pesananmu. <Link className="font-bold text-[#5148df]" href={'/login?next=' + encodeURIComponent(path)}>Masuk</Link></p>
  if (auth.user.role !== 'CUSTOMER') return <p role="alert" className="mt-6">Halaman pesanan untuk akun customer. <Link href="/organizer" className="font-bold text-[#5148df]">Buka dashboard organizer</Link></p>
  return null
}
function OrganizerPurchaseAccess() {
  return <main className="mx-auto max-w-4xl px-4 py-8 text-[#11103d] sm:px-6"><h1 className="text-3xl font-black">Kelola transaksi event</h1>
    <p className="mt-4 text-sm">Kamu masuk sebagai organizer. Pesanan customer diperiksa melalui dashboard organizer.</p>
    <Link href="/organizer" className={primary + ' mt-6'}>Buka dashboard organizer</Link></main>
}
export function TemporaryPurchases() {
  const auth = useAuth(), userId = auth.user?.role === 'CUSTOMER' ? auth.user.id : null
  const [result, setResult] = useState<{ userId: string; rows: CustomerPurchase[] } | null>(null), [error, setError] = useState('')
  useEffect(() => {
    const abort = new AbortController(); setResult(null); setError('')
    if (userId) void auth.client.customerPurchases(abort.signal).then(rows => {
      if (!abort.signal.aborted) setResult({ userId, rows })
    }).catch(reason => { if (!abort.signal.aborted) setError(reason.message) })
    return () => abort.abort()
  }, [auth.client, userId])
  const rows = result?.userId === userId ? result.rows : null
  if (auth.user?.role === 'ORGANIZER') return <OrganizerPurchaseAccess />
  return <main className="mx-auto max-w-4xl px-4 py-8 text-[#11103d] sm:px-6"><h1 className="text-3xl font-black">Pesanan saya</h1>
    <p className="mt-2 text-sm text-[#77738b]">20 pesanan terbaru dari akunmu.</p><Access path="/transactions" />
    {error && <p role="alert" className="mt-5">{error}</p>}
    {userId && !rows && !error && <p role="status" className="mt-6">Memuat pesanan…</p>}
    {rows && !rows.length && <p className={card + ' mt-6'}>Belum ada pesanan. <Link href="/" className="font-bold text-[#5148df]">Jelajahi event</Link></p>}
    <div className="mt-6 space-y-4">{rows?.map(row => <Link href={'/transactions/' + row.id} key={row.id} aria-label={'Lihat detail pesanan ' + row.event.title} className={card + ' group block min-w-0 transition-colors hover:border-[#5148df] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5148df]'}>
      <h2 className="text-lg font-black">{row.event.title}</h2><p className="mt-2 text-sm font-bold text-[#5148df]">{labels[row.status]}</p>
      <p className="mt-2 break-all text-xs text-[#77738b]">{row.reference}</p><p className="mt-3 font-bold">{money(row.totalPrice)} · {date(row.createdAt)}</p>
      <span className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#ddd6f7] px-4 py-2 text-sm font-bold text-[#5148df] group-hover:bg-[#f2edff]">Lihat detail pesanan <span aria-hidden="true">→</span></span></Link>)}</div>
  </main>
}

export function TemporaryPurchase({ id }: { id: string }) {
  const auth = useAuth(), userId = auth.user?.role === 'CUSTOMER' ? auth.user.id : null
  const [result, setResult] = useState<{ userId: string; value: CustomerPurchase } | null>(null)
  const [file, setFile] = useState<File | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [, setTick] = useState(0), [offset, setOffset] = useState(0), [notice, setNotice] = useState('')
  const current = useRef(userId), sending = useRef(false)
  current.current = userId
  const reload = useCallback(async (signal?: AbortSignal) => {
    if (!userId) return
    const value = await auth.client.customerPurchase(id, signal)
    if (signal?.aborted || current.current !== userId) return
    setOffset(Date.parse(value.serverTime) - Date.now()); setResult({ userId, value }); setError('')
  }, [auth.client, id, userId])
  const purchase = result?.userId === userId && result.value.id === id ? result.value : null
  useEffect(() => {
    const abort = new AbortController(); setResult(null); setFile(null); setError(''); setNotice('')
    void reload(abort.signal).catch(reason => { if (!abort.signal.aborted) setError(reason.message) })
    return () => abort.abort()
  }, [reload])
  const waiting = purchase?.status === 'WAITING_FOR_PAYMENT' || purchase?.status === 'WAITING_FOR_ADMIN_CONFIRMATION'
  useEffect(() => {
    if (!waiting) return
    const abort = new AbortController()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && !sending.current) void reload(abort.signal).catch(() => { /* Manual refresh remains available. */ })
    }, 15000)
    return () => { clearInterval(timer); abort.abort() }
  }, [reload, waiting])
  useEffect(() => { if (!waiting) return; const timer = setInterval(() => setTick(n => n + 1), 1000); return () => clearInterval(timer) }, [waiting])
  const deadline = purchase?.status === 'WAITING_FOR_PAYMENT' ? purchase.paymentDueAt : purchase?.decisionDueAt
  const seconds = Math.max(0, Math.ceil(((deadline ? Date.parse(deadline) : 0) - Date.now() - offset) / 1000))
  async function upload() {
    if (!purchase || !file || !userId || sending.current) return
    sending.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const value = await auth.client.uploadPurchaseProof(id, file, userId)
      if (current.current !== userId) return
      setOffset(Date.parse(value.serverTime) - Date.now()); setResult({ userId, value }); setFile(null)
      setNotice('Bukti tersimpan. Menunggu konfirmasi organizer.')
    } catch (reason) { if (current.current === userId) setError(reason instanceof Error ? reason.message : 'Periksa status pesanan sebelum mencoba kembali.') }
    finally { sending.current = false; setBusy(false) }
  }
  if (auth.user?.role === 'ORGANIZER') return <OrganizerPurchaseAccess />
  return <main className="mx-auto max-w-4xl px-4 py-8 text-[#11103d] sm:px-6"><Link href="/transactions" className="text-sm font-bold text-[#5148df]">← Pesanan saya</Link>
    <h1 className="mt-5 text-3xl font-black">Detail pesanan</h1><Access path={'/transactions/' + id} />
    {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    {notice && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</p>}
    {userId && !purchase && !error && <p role="status" className="mt-6">Memuat pesanan…</p>}
    {purchase && <div className="mt-6 space-y-5">
      <section className={card}><h2 className="text-xl font-black">{labels[purchase.status]}</h2><p className="mt-2 break-all text-xs text-[#77738b]">{purchase.reference}</p>
        {waiting && deadline && <><p className="mt-4 text-sm">{purchase.status === 'WAITING_FOR_PAYMENT' ? 'Batas unggah bukti' : 'Batas konfirmasi organizer'}: {date(deadline)}</p><p className="mt-2 font-bold" role="timer">{seconds ? `${Math.floor(seconds / 3600)}j ${Math.floor(seconds / 60) % 60}m ${seconds % 60}d` : 'Batas waktu tercapai; menunggu pembaruan status.'}</p></>}
        {purchase.status === 'WAITING_FOR_ADMIN_CONFIRMATION' && <p className="mt-3 text-sm">Bukti pembayaran tersimpan. Organizer akan memeriksa pesananmu.</p>}
        {['REJECTED', 'EXPIRED', 'CANCELED'].includes(purchase.status) && <p className="mt-3 text-sm">Reservasi tiket dilepas. Poin dan kupon dikembalikan sesuai masa berlaku aslinya.</p>}
        <button type="button" disabled={busy} className="mt-4 rounded-xl border px-4 py-2 text-sm font-bold" onClick={() => void reload().catch(reason => setError(reason.message))}>Perbarui status</button></section>
      <section className={card}><h2 className="text-xl font-black">{purchase.event.title}</h2><p className="mt-2 text-sm text-[#77738b]">{date(purchase.event.date)} · {purchase.event.venue || purchase.event.location}</p>
        <div className="mt-5 space-y-3 text-sm">{purchase.items.map(item => <p key={item.ticketTypeId} className="flex justify-between gap-3"><span>{item.name} × {item.quantity}</span><strong>{money(item.lineTotal)}</strong></p>)}
          <p className="flex justify-between gap-3 border-t pt-3"><span>Subtotal</span><strong>{money(purchase.subtotal)}</strong></p>
          {purchase.voucherDiscount > 0 && <p className="flex justify-between gap-3"><span>Voucher event</span><strong>−{money(purchase.voucherDiscount)}</strong></p>}
          <p className="flex justify-between gap-3"><span>Kupon referral</span><strong>−{money(purchase.couponDiscount)}</strong></p><p className="flex justify-between gap-3"><span>Poin</span><strong>−{money(purchase.pointsUsed)}</strong></p>
          <p className="flex justify-between gap-3 border-t pt-3 text-xl font-black"><span>Total pembayaran</span><span>{money(purchase.totalPrice)}</span></p></div></section>
      {purchase.status === 'WAITING_FOR_PAYMENT' && seconds > 0 && <section className={card}><h2 className="text-xl font-black">Unggah bukti pembayaran</h2>
        {purchase.paymentInstructions ? <div className="mt-4 rounded-xl bg-[#f2edff] p-4 text-sm"><p>{purchase.paymentInstructions.bank}</p><p className="mt-2 break-all font-black">{purchase.paymentInstructions.accountNumber}</p><p className="mt-2">a.n. {purchase.paymentInstructions.accountName}</p></div>
          : <p className="mt-3 text-sm">Pembayaran uji: gunakan gambar bukti uji. Tidak perlu transfer uang.</p>}
        <p className="mt-3 text-sm text-[#77738b]">PNG atau JPEG, maksimal 3 MB. Bukti hanya dapat dilihat olehmu dan organizer event.</p>
        <label className="mt-5 block text-sm font-bold">Bukti pembayaran<input aria-label="Bukti pembayaran" type="file" accept="image/png,image/jpeg" disabled={busy} className="mt-2 block w-full max-w-full rounded-xl border p-3 font-normal" onChange={event => {
          const next = event.target.files?.[0] ?? null; setError(''); setFile(null)
          if (next && (!['image/png', 'image/jpeg'].includes(next.type) || next.size > 3 * 1024 * 1024)) { setError('Gunakan PNG atau JPEG, maksimal 3 MB.'); event.target.value = ''; return }
          setFile(next)
        }} /></label><button type="button" disabled={busy || !file} className={primary + ' mt-5'} onClick={() => void upload()}>{busy ? 'Mengunggah…' : 'Kirim bukti pembayaran'}</button></section>}
      {purchase.proofUploadedAt && <section className={card}><h2 className="font-black">Bukti tersimpan</h2><p className="mt-2 text-sm">Diunggah {date(purchase.proofUploadedAt)}</p><a target="_blank" rel="noreferrer" href={'/api/me/purchases/' + id + '/proof'} className="mt-3 inline-block text-sm font-bold text-[#5148df]">Lihat bukti pembayaran</a></section>}
      {purchase.status === 'DONE' && <section className={card}><h2 className="text-xl font-black">Tiket dikonfirmasi</h2><p className="mt-3 text-sm">Pesananmu tercatat pada daftar peserta organizer. Kamu dapat membuka ulasan event secara langsung.</p><Link className={primary + ' mt-5'} href={'/events/' + purchase.event.id + '/review'}>Lihat dan tulis ulasan</Link></section>}
      <div className="flex flex-wrap gap-5 text-sm font-bold text-[#5148df]"><Link href={'/events/' + purchase.event.id}>Lihat event</Link><Link href="/account#rewards">Lihat poin & kupon</Link></div>
    </div>}
  </main>
}
