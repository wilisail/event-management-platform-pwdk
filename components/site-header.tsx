'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from '../feature-2/components/auth-provider'
import { UiLogo } from '../feature-2/components/ui-logo'
import { accountError } from '../feature-2/lib/auth-client'
import { useRolePageTitle } from '../feature-2/components/use-role-page-title'

export function SiteHeader({ view = 'discovery' }: { view?: 'discovery' | 'event' | 'review' | 'organizer' | 'create' | 'checkout' | 'orders' | 'order' }) {
  const auth = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const organizer = auth.user?.role === 'ORGANIZER'
  const titles = { discovery: 'Jelajahi event', event: 'Detail event', review: organizer ? 'Ulasan peserta' : 'Ulasan event',
    organizer: 'Profil penyelenggara', create: 'Buat event', checkout: organizer ? 'Pratinjau event' : 'Pilih tiket',
    orders: organizer ? 'Akses pesanan customer' : 'Pesanan saya', order: organizer ? 'Akses pesanan customer' : 'Detail pesanan' }
  useRolePageTitle(titles[view], auth.user?.role)
  const captions = { discovery: 'Jelajahi event', event: 'Halaman publik event · tampilan untuk pengunjung',
    review: organizer ? 'Ulasan peserta · tampilan organizer' : 'Ulasan event · baca dan bagikan pengalaman',
    organizer: 'Profil publik penyelenggara', create: 'Buat event', checkout: organizer ? 'Pratinjau event · pembelian menggunakan akun customer' : 'Pilih tiket dan periksa pesanan',
    orders: organizer ? 'Kelola transaksi melalui dashboard organizer' : 'Pesanan saya', order: organizer ? 'Kelola transaksi melalui dashboard organizer' : 'Detail pesanan' }
  async function signOut() {
    setBusy(true); setError('')
    try { await auth.signOut() }
    catch (reason) { setError(accountError(reason)) }
    finally { setBusy(false) }
  }
  return <header className="sticky top-0 z-20 border-b border-[#eee9fb] bg-white/95 backdrop-blur">
    <div className="mx-auto flex min-h-16 max-w-[1180px] flex-wrap items-center justify-between gap-3 px-5 py-3">
      <UiLogo />
      <nav aria-label="Navigasi utama" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-[#5148df]">
        <Link href="/#explore">Jelajahi event</Link>
        {auth.status === 'loading' ? <span role="status" className="text-[#77738b]">Memeriksa akun…</span>
          : auth.user ? <>
            <span className={'rounded-full px-2 py-1 text-[11px] ' + (organizer ? 'bg-[#e8f7f0] text-[#1b654a]' : 'bg-[#f2edff] text-[#5148df]')}>{organizer ? 'Organizer' : 'Customer'}</span>
            {auth.user.role === 'ORGANIZER' ? <>
              <Link href="/organizer">Dashboard organizer</Link>
              {view !== 'create' ? <Link href="/organizer/events/new">Buat event</Link> : null}
            </> : null}
            <Link href="/account">Akun saya</Link>
            {auth.user.role === 'CUSTOMER' && <Link href="/transactions">Pesanan saya</Link>}
            <button type="button" disabled={busy} onClick={() => void signOut()} className="rounded-full border border-[#ddd6f7] px-3 py-2 disabled:opacity-60">{busy ? 'Keluar…' : 'Keluar'}</button>
          </> : <>
            <Link href="/login">Masuk</Link>
            <Link href="/register" className="rounded-full bg-[#5148df] px-4 py-2 text-white">Daftar</Link>
          </>}
      </nav>
    </div>
    {view !== 'discovery' || auth.user ? <div className="mx-auto max-w-[1180px] px-5 pb-3 text-xs text-[#77738b]">
      {auth.user ? `${organizer ? 'Area organizer' : 'Area customer'} · ` : ''}{captions[view]}
    </div> : null}
    {error ? <p role="alert" className="mx-auto max-w-[1180px] px-5 pb-3 text-sm text-red-700">{error}</p> : null}
  </header>
}
