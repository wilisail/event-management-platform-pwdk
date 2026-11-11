'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from '../feature-2/components/auth-provider'
import { UiLogo } from '../feature-2/components/ui-logo'
import { accountError } from '../feature-2/lib/auth-client'

export function SiteHeader({ view = 'discovery' }: { view?: 'discovery' | 'event' | 'organizer' | 'create' | 'checkout' }) {
  const auth = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
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
            <span className="rounded-full bg-[#f2edff] px-2 py-1 text-[11px]">{auth.user.role === 'ORGANIZER' ? 'Organizer' : 'Customer'}</span>
            {auth.user.role === 'ORGANIZER' ? <>
              <Link href="/organizer">Dashboard organizer</Link>
              {view !== 'create' ? <Link href="/organizer/events/new">Buat event</Link> : null}
            </> : null}
            <Link href="/account">Akun saya</Link>
            <button type="button" disabled={busy} onClick={() => void signOut()} className="rounded-full border border-[#ddd6f7] px-3 py-2 disabled:opacity-60">{busy ? 'Keluar…' : 'Keluar'}</button>
          </> : <>
            <Link href="/login">Masuk</Link>
            <Link href="/register" className="rounded-full bg-[#5148df] px-4 py-2 text-white">Daftar</Link>
          </>}
      </nav>
    </div>
    {view !== 'discovery' ? <div className="mx-auto max-w-[1180px] px-5 pb-3 text-xs text-[#77738b]">
      {view === 'event' ? 'Halaman publik event · tampilan untuk pengunjung'
        : view === 'organizer' ? 'Profil publik penyelenggara'
        : view === 'create' ? 'Area organizer · buat event' : 'Informasi pembelian'}
    </div> : null}
    {error ? <p role="alert" className="mx-auto max-w-[1180px] px-5 pb-3 text-sm text-red-700">{error}</p> : null}
  </header>
}
