'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AccountFrame } from './account-shell'
import { useAuth } from './auth-provider'
import { accountError } from '../lib/auth-client'

const genericMessage = 'Jika email terdaftar, tautan pemulihan akan dikirim. Periksa juga folder spam.'

export function PasswordRecovery({ mode }: { mode: 'request' | 'reset' }) {
  const auth = useAuth(), form = useRef<HTMLFormElement>(null), dialog = useRef<HTMLDialogElement>(null)
  const initialized = useRef(false), token = useRef(''), inFlight = useRef(false)
  const [ready, setReady] = useState(mode === 'request'), [valid, setValid] = useState(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState(false)
  const errorRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (mode !== 'reset') return
    const readLink = () => {
      if (!window.location.hash && initialized.current) return
      initialized.current = true
      const value = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? ''
      // Fragment never reaches HTTP logs. Remove it from the current history entry immediately.
      window.history.replaceState(null, '', '/reset-password')
      token.current = /^[A-Za-z0-9_-]{43}$/.test(value) ? value : ''
      form.current?.reset(); setError(''); setSuccess(false)
      setValid(Boolean(token.current)); setReady(true)
    }
    readLink()
    window.addEventListener('hashchange', readLink)
    return () => window.removeEventListener('hashchange', readLink)
  }, [mode])
  const showError = (message: string) => { setError(message); queueMicrotask(() => errorRef.current?.focus()) }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (inFlight.current) return; setError('')
    if (mode === 'reset') {
      const data = new FormData(event.currentTarget), password = String(data.get('password') ?? '')
      if ([...password].length < 15 || [...password].length > 128 || !password.trim()) {
        showError('Gunakan kata sandi baru dengan 15–128 karakter, bukan hanya spasi.'); return
      }
      if (password !== data.get('confirmation')) { showError('Konfirmasi kata sandi belum sama.'); return }
      dialog.current?.showModal(); return
    }
    const email = String(new FormData(event.currentTarget).get('email') ?? '')
    inFlight.current = true; setBusy(true)
    try { await auth.client.requestPasswordReset(email); form.current?.reset(); setSuccess(true) }
    catch (reason) { showError(accountError(reason)) }
    finally { inFlight.current = false; setBusy(false) }
  }
  const confirm = async () => {
    if (inFlight.current) return
    inFlight.current = true
    const password = String(new FormData(form.current!).get('password') ?? '')
    dialog.current?.close(); setBusy(true); form.current?.reset()
    try { await auth.resetPassword(token.current, password); token.current = ''; setSuccess(true) }
    catch (reason) { showError(accountError(reason)) }
    finally { inFlight.current = false; setBusy(false) }
  }
  const cancel = () => { dialog.current?.close(); form.current?.reset() }
  return <AccountFrame><main className="width main auth-layout">
    <section className="auth-story"><p className="eyebrow">PEMULIHAN AKUN</p><h1>Kembali ke pengalaman berikutnya.</h1>
      <p>Pulihkan akses akun melalui email yang kamu gunakan saat mendaftar.</p><div className="auth-story-mark" aria-hidden="true">✦</div>
    </section>
    <section className="panel auth-card"><p className="eyebrow">KATA SANDI</p>
      <h2>{mode === 'request' ? 'Lupa kata sandi?' : 'Pilih kata sandi baru.'}</h2>
      {!ready ? <p role="status">Memeriksa tautan…</p> : success ? <div role="status">
        <p className="notice">{mode === 'request' ? genericMessage : 'Kata sandi berhasil dipulihkan. Semua sesi akun telah keluar. Masuk kembali dengan kata sandi baru.'}</p>
        <Link className="primary" href="/login">Kembali ke halaman masuk</Link>
      </div> : mode === 'reset' && !valid ? <><p className="auth-error" role="alert">Tautan tidak valid atau sudah berakhir. Minta tautan baru.</p>
        <Link className="primary" href="/forgot-password">Minta tautan baru</Link></> : <>
        <p className="auth-intro">{mode === 'request' ? 'Tautan berlaku 15 menit dan hanya dapat dipakai sekali.' : 'Setelah disimpan, semua perangkat akun perlu masuk kembali.'}</p>
        {error && <p className="auth-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
        <form ref={form} className="profile-form" onSubmit={submit}>
          {mode === 'request' ? <label htmlFor="recovery-email">Email<input id="recovery-email" name="email" type="email" required autoComplete="email" maxLength={254} disabled={busy} /></label> : <>
            <label htmlFor="recovery-password">Kata sandi baru<input id="recovery-password" name="password" type="password" required autoComplete="new-password" aria-describedby="recovery-help" disabled={busy} /></label>
            <p id="recovery-help" className="help">Gunakan 15–128 karakter. Spasi dan karakter tetap disimpan sesuai yang kamu isi.</p>
            <label htmlFor="recovery-confirmation">Konfirmasi kata sandi baru<input id="recovery-confirmation" name="confirmation" type="password" required autoComplete="new-password" disabled={busy} /></label>
          </>}
          <button className="primary auth-submit" type="submit" disabled={busy}>{busy ? 'Memproses…' : mode === 'request' ? 'Kirim tautan pemulihan' : 'Simpan kata sandi baru'}</button>
        </form>
        <p className="auth-switch"><Link className="link" href={mode === 'request' ? '/login' : '/forgot-password'}>{mode === 'request' ? 'Kembali ke halaman masuk' : 'Minta tautan baru'}</Link></p>
      </>}
    </section>
    <dialog className="confirm-dialog" ref={dialog} onCancel={cancel} aria-labelledby="recovery-confirm-title">
      <h2 id="recovery-confirm-title">Pulihkan kata sandi?</h2><p>Semua sesi akun akan keluar. Gunakan kata sandi baru untuk masuk kembali.</p>
      <div className="auth-actions"><button className="secondary" autoFocus onClick={cancel}>Batal</button><button className="primary" onClick={() => void confirm()} disabled={busy}>Ya, pulihkan kata sandi</button></div>
    </dialog>
  </main></AccountFrame>
}
