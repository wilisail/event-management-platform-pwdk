'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { UserView } from '../contracts/types'
import { accountError } from '../lib/auth-client'
import { useAuth } from './auth-provider'
import { ProfileAvatar } from './profile-avatar'

export function ProfileEditor({ user }: { user: UserView }) {
  const auth = useAuth()
  const [name, setName] = useState(user.name), [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [pending, setPending] = useState<'name' | 'picture' | null>(null)
  const dialog = useRef<HTMLDialogElement>(null), fileInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  const chooseFile = (chosen: File | undefined) => {
    setError(''); setNotice(''); setFile(null)
    if (!chosen) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(chosen.type) || !chosen.size || chosen.size > 5 * 1024 * 1024) {
      setError('Pilih foto JPEG, PNG atau WebP berukuran maksimal 5 MiB.')
      if (fileInput.current) fileInput.current.value = ''
      return
    }
    setFile(chosen)
  }
  const confirm = (type: 'name' | 'picture', event?: FormEvent) => {
    event?.preventDefault()
    if (busy) return
    if (type === 'name' && (name.trim().length < 2 || name.trim().length > 100 || /[\u0000-\u001f\u007f]/.test(name))) {
      setError('Masukkan nama dengan 2–100 karakter tanpa baris baru.'); return
    }
    if (type === 'picture' && !file) return
    setPending(type); dialog.current?.showModal()
  }
  const save = async () => {
    if (!pending || busy) return
    const action = pending
    dialog.current?.close(); setPending(null); setBusy(true); setError(''); setNotice('')
    try {
      if (action === 'name') {
        const updated = await auth.saveName(name.trim()); setName(updated.name); setNotice('Nama profil berhasil disimpan.')
      } else if (file) {
        await auth.uploadPicture(file); setFile(null)
        if (fileInput.current) fileInput.current.value = ''
        setNotice('Foto profil berhasil disimpan.')
      }
    } catch (reason) { setError(accountError(reason)) }
    finally { setBusy(false) }
  }
  return <div className="panel"><div className="section-title"><div>
    <p className="eyebrow">PROFIL</p><h2>Kenalan lebih dekat.</h2></div><span className="badge">Akun terhubung</span></div>
    {error && <div className="auth-error profile-message" role="alert"><p>{error}</p>
      <button className="secondary" type="button" disabled={busy} onClick={() => void auth.reload()}>Muat ulang profil</button></div>}
    {notice && <p className="notice profile-message" role="status">{notice}</p>}
    <section className="profile-photo" aria-labelledby="profile-photo-title" aria-busy={busy}>
      <ProfileAvatar name={user.name} url={preview || user.profilePictureUrl} />
      <div className="profile-photo-controls"><h3 id="profile-photo-title">Foto profil</h3>
        <label htmlFor="profile-photo-input" className="help">JPEG, PNG atau WebP · maksimal 5 MiB dan 16 megapiksel.</label>
        <input ref={fileInput} id="profile-photo-input" type="file" accept="image/jpeg,image/png,image/webp"
          disabled={busy} onChange={event => chooseFile(event.target.files?.[0])} />
        {file && <div className="auth-actions"><button className="secondary" type="button" disabled={busy}
          onClick={() => confirm('picture')}>Simpan foto</button><button className="link" type="button" disabled={busy}
            onClick={() => { setFile(null); if (fileInput.current) fileInput.current.value = '' }}>Batal memilih</button></div>}
        {user.role === 'ORGANIZER' && <p className="help">Nama dan foto ini ditampilkan pada profil organizer publik.</p>}
      </div>
    </section>
    <form className="profile-form" onSubmit={event => confirm('name', event)} aria-busy={busy}>
      <label htmlFor="profile-name">Nama tampilan<input id="profile-name" name="name" autoComplete="name" value={name}
        minLength={2} maxLength={100} required disabled={busy} onChange={event => setName(event.target.value)} /></label>
      <label>Email<input value={user.email} readOnly /></label><div className="form-grid">
        <label>Peran<input value={user.role === 'CUSTOMER' ? 'Customer' : 'Organizer'} readOnly /></label>
        <label>Kode referral tetap<input value={user.referralCode} readOnly /></label></div>
      <button className="primary" disabled={busy || name.trim() === user.name} type="submit">{busy ? 'Menyimpan…' : 'Simpan nama'}</button>
      {user.role === 'ORGANIZER' && <Link className="link" href={'/organizers/' + user.id}>Lihat profil organizer publik ↗</Link>}
    </form>
    <dialog className="confirm-dialog" ref={dialog} aria-labelledby="profile-confirm-title" onCancel={() => setPending(null)}>
      <h2 id="profile-confirm-title">{pending === 'picture' ? 'Simpan foto profil?' : 'Simpan nama profil?'}</h2>
      <p>{pending === 'picture' ? 'Foto yang dipilih akan menggantikan foto profil saat ini.' : 'Nama profil akan menjadi “' + name.trim() + '”.'}</p>
      <div className="auth-actions"><button className="secondary" type="button" autoFocus
        onClick={() => { dialog.current?.close(); setPending(null) }}>Batal</button>
        <button className="primary" type="button" onClick={() => void save()}>Ya, simpan</button></div>
    </dialog>
  </div>
}
