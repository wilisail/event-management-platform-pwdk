'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import type { Role } from '../contracts/types'
import { accountError, safeReturnPath } from '../lib/auth-client'
import { useAuth } from './auth-provider'
import { UiLogo } from './ui-logo'

export function AccountHeader() {
  const auth = useAuth(), router = useRouter()
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const signOut = async () => {
    setBusy(true); setError('')
    try { await auth.signOut(); router.replace('/login') }
    catch (reason) { setError(accountError(reason)) }
    finally { setBusy(false) }
  }
  return <>
    <header className="header"><div className="width flex items-center justify-between gap-3">
      <UiLogo />
      <nav className="account-nav" aria-label="Navigasi utama">
        <a className="link discovery-link" href={process.env.NEXT_PUBLIC_F1_ORIGIN || 'http://localhost:3000'}>Jelajahi event ↗</a>
        {auth.user?.role === 'ORGANIZER' && <Link className="link" href="/organizer">Dashboard</Link>}
        {auth.user ? <><Link className="link" href="/account">Akun saya</Link>
          <button className="secondary compact" onClick={signOut} disabled={busy}>{busy ? 'Keluar…' : 'Keluar'}</button></>
          : <Link className="link" href="/login">Masuk</Link>}
      </nav>
    </div></header>
    {error && <p className="width auth-error" role="alert">{error}</p>}
  </>
}

export function ProtectedPage({ role, children }: { role?: Role; children: ReactNode }) {
  const auth = useAuth(), router = useRouter(), pathname = usePathname()
  useEffect(() => {
    if (auth.status === 'anonymous') router.replace('/login?next=' + encodeURIComponent(safeReturnPath(pathname)))
  }, [auth.status, pathname, router])
  if (auth.status === 'loading' || auth.status === 'anonymous') return <div className="width main"><div className="panel" role="status">Memeriksa sesi akun…</div></div>
  if (auth.status === 'error') return <div className="width main"><div className="panel" role="alert">
    <h1>Akun belum dapat dimuat</h1><p>{auth.error}</p><div className="auth-actions">
      <button className="primary" onClick={() => void auth.reload()}>Coba lagi</button><Link className="secondary" href="/login">Masuk ulang</Link>
    </div></div></div>
  if (role && auth.user?.role !== role) return <div className="width main"><div className="panel" role="alert">
    <p className="eyebrow">403 · AKSES TERBATAS</p><h1>Halaman khusus organizer.</h1>
    <p>Akun customer tetap dapat mengakses profil dan referral miliknya.</p><Link className="primary" href="/account">Kembali ke akun saya</Link>
  </div></div>
  return children
}

export function AccountFrame({ children }: { children: ReactNode }) {
  return <><AccountHeader />{children}<footer className="width footer">TemuEvent · Akun, komunitas, dan pengalaman berikutnya.</footer></>
}
