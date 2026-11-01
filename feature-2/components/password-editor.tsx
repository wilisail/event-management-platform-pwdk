'use client'

import { useRef, useState, type FormEvent } from 'react'
import { accountError } from '../lib/auth-client'
import { useAuth } from './auth-provider'

export function PasswordEditor() {
  const auth = useAuth()
  const form = useRef<HTMLFormElement>(null), dialog = useRef<HTMLDialogElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null), inFlight = useRef(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const invalid = (message: string) => {
    setError(message); queueMicrotask(() => errorRef.current?.focus()); return null
  }
  const readFields = () => {
    if (!form.current) return null
    const values = new FormData(form.current)
    const currentPassword = String(values.get('currentPassword') ?? ''), newPassword = String(values.get('newPassword') ?? '')
    if (!currentPassword || [...currentPassword].length > 128) return invalid('Masukkan kata sandi saat ini, maksimal 128 karakter.')
    if ([...newPassword].length < 15 || [...newPassword].length > 128 || !newPassword.trim()) {
      return invalid('Gunakan kata sandi baru dengan 15–128 karakter, bukan hanya spasi.')
    }
    if (currentPassword === newPassword) return invalid('Pilih kata sandi baru yang berbeda dari kata sandi saat ini.')
    if (newPassword !== String(values.get('confirmation') ?? '')) return invalid('Konfirmasi kata sandi baru belum cocok.')
    return { currentPassword, newPassword }
  }
  const confirm = (event: FormEvent) => {
    event.preventDefault()
    if (inFlight.current) return
    setError('')
    if (readFields()) dialog.current?.showModal()
  }
  const cancel = () => { dialog.current?.close(); form.current?.reset(); setError('') }
  const save = async () => {
    if (inFlight.current) return
    const fields = readFields()
    if (!fields) { dialog.current?.close(); return }
    inFlight.current = true; setBusy(true); setError(''); dialog.current?.close()
    try { await auth.changePassword(fields.currentPassword, fields.newPassword) }
    catch (reason) { invalid(accountError(reason)) }
    finally { form.current?.reset(); inFlight.current = false; setBusy(false) }
  }
  return <section className="panel" aria-labelledby="password-title"><p className="eyebrow">KATA SANDI & SESI</p>
    <h2 id="password-title">Jaga akunmu tetap aman.</h2>
    <p>Setelah kata sandi diubah, semua perangkat akan keluar, termasuk sesi ini. Masuk kembali dengan kata sandi baru.</p>
    {error && <p className="auth-error profile-message" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
    <form className="profile-form" ref={form} onSubmit={confirm} aria-busy={busy}>
      <label htmlFor="password-current">Kata sandi saat ini<input id="password-current" name="currentPassword" type="password"
        autoComplete="current-password" required disabled={busy} /></label>
      <label htmlFor="password-new">Kata sandi baru<input id="password-new" name="newPassword" type="password"
        autoComplete="new-password" aria-describedby="password-change-help" required disabled={busy} /></label>
      <p className="help" id="password-change-help">Gunakan 15–128 karakter. Spasi dan huruf Unicode dapat digunakan; kata sandi tidak dipotong atau diubah.</p>
      <label htmlFor="password-confirmation">Konfirmasi kata sandi baru<input id="password-confirmation" name="confirmation"
        type="password" autoComplete="new-password" required disabled={busy} /></label>
      <button className="primary" type="submit" disabled={busy}>{busy ? 'Mengubah kata sandi…' : 'Ubah kata sandi'}</button>
    </form>
    <dialog className="confirm-dialog" ref={dialog} aria-labelledby="password-confirm-title" onCancel={cancel}>
      <h2 id="password-confirm-title">Ubah kata sandi sekarang?</h2><p>Semua sesi akan keluar. Kamu perlu masuk kembali dengan kata sandi baru.</p>
      <div className="auth-actions"><button className="secondary" type="button" autoFocus onClick={cancel}>Batal</button>
        <button className="primary" type="button" onClick={() => void save()}>Ya, ubah dan keluar</button></div>
    </dialog>
  </section>
}
