'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'
import type { Role } from '../contracts/types'
import { accountError, safeReturnPath } from '../lib/auth-client'
import { useAuth } from './auth-provider'
import { AccountFrame } from './account-shell'

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const auth = useAuth(), router = useRouter(), search = useSearchParams()
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [created, setCreated] = useState(false)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const isRegister = mode === 'register'
  const next = safeReturnPath(search.get('next'))
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') ?? ''), password = String(data.get('password') ?? '')
    const name = String(data.get('name') ?? '').trim()
    setError('')
    if (isRegister && ([...password].length < 15 || [...password].length > 128)) {
      setError('Gunakan kata sandi antara 15 dan 128 karakter.'); return
    }
    if (isRegister && (name.length < 2 || name.length > 100)) { setError('Nama harus terdiri dari 2–100 karakter.'); return }
    setBusy(true)
    try {
      if (isRegister) {
        const referralCode = String(data.get('referralCode') ?? '').trim()
        await auth.client.register({ name, email, password,
          role: data.get('role') === 'ORGANIZER' ? 'ORGANIZER' as Role : 'CUSTOMER',
          ...(referralCode ? { referralCode } : {}),
        })
        setCreated(true)
      } else {
        const user = await auth.signIn({ email, password })
        router.replace(safeReturnPath(search.get('next'), user.role === 'ORGANIZER' ? '/organizer' : '/account'))
      }
    } catch (reason) { setError(accountError(reason)); queueMicrotask(() => errorRef.current?.focus()) }
    finally { setBusy(false) }
  }
  return <AccountFrame><main className="width main auth-layout">
    <section className="auth-story"><p className="eyebrow">AKUN TEMUEVENT</p>
      <h1>{isRegister ? 'Pengalaman berikutnya dimulai di sini.' : 'Selamat datang kembali.'}</h1>
      <p>Temukan komunitas, simpan pengalaman, dan sambut event berikutnya bersama TemuEvent.</p>
      <div className="auth-story-mark" aria-hidden="true">✦</div>
      <p className="auth-story-caption">Lebih dekat dengan pengalaman yang kamu sukai.</p>
    </section>
    <section className="panel auth-card">
      {created ? <div role="status"><span className="badge">Akun berhasil dibuat</span><h2>Siap untuk masuk.</h2>
        <p>Akunmu sudah tersimpan. Masuk dengan email dan kata sandi yang baru dibuat.</p>
        <Link className="primary" href={'/login?next=' + encodeURIComponent(next)}>Masuk ke akun</Link>
      </div> : <>
        <p className="eyebrow">{isRegister ? 'BUAT AKUN' : 'MASUK AKUN'}</p>
        <h2>{isRegister ? 'Kenalan dulu, yuk.' : 'Lanjutkan pengalamanmu.'}</h2>
        <p className="auth-intro">{isRegister ? 'Satu akun untuk pengalaman event yang lebih personal.' : 'Masukkan email dan kata sandimu.'}</p>
        {!isRegister && auth.notice && <p className="notice" role="status">{auth.notice}</p>}
        {error && <p className="auth-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
        <form className="profile-form" onSubmit={submit}>
          {isRegister && <label htmlFor="auth-name">Nama<input id="auth-name" name="name" required autoComplete="name" maxLength={100} disabled={busy} /></label>}
          <label htmlFor="auth-email">Email<input id="auth-email" name="email" type="email" required maxLength={254} autoComplete="email" disabled={busy} /></label>
          <label htmlFor="auth-password">Kata sandi<input id="auth-password" name="password" type="password" required autoComplete={isRegister ? 'new-password' : 'current-password'} aria-describedby={isRegister ? 'password-help' : undefined} disabled={busy} /></label>
          {isRegister && <>
            <p id="password-help" className="help">Gunakan 15–128 karakter. Kata sandi panjang dengan beberapa kata mudah diingat.</p>
            <fieldset className="role-fields"><legend>Daftar sebagai</legend><div className="role-options">
              <label><input type="radio" name="role" value="CUSTOMER" defaultChecked disabled={busy} /> Customer</label>
              <label><input type="radio" name="role" value="ORGANIZER" disabled={busy} /> Organizer</label>
            </div></fieldset>
            <label htmlFor="auth-referral">Kode referral (opsional)<input id="auth-referral" name="referralCode"
              maxLength={16} autoComplete="off" autoCapitalize="characters" spellCheck={false}
              aria-describedby="referral-help" disabled={busy} /></label>
            <p id="referral-help" className="help">Dengan kode yang valid, kamu mendapat kupon dan pengundang mendapat 10.000 poin. Reward berlaku tiga bulan.</p>
          </>}
          <button className="primary auth-submit" disabled={busy} type="submit">{busy ? 'Memproses…' : isRegister ? 'Buat akun' : 'Masuk'}</button>
        </form>
        <p className="auth-switch">{isRegister ? 'Sudah punya akun? ' : 'Belum punya akun? '}
          <Link className="link" href={(isRegister ? '/login' : '/register') + '?next=' + encodeURIComponent(next)}>{isRegister ? 'Masuk' : 'Daftar sekarang'}</Link>
        </p>
      </>}
    </section>
  </main></AccountFrame>
}

