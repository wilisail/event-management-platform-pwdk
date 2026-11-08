'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { accountError, createAuthClient } from '../feature-2/lib/auth-client'

export function IntegrationLogin() {
  const router = useRouter()
  const [client] = useState(() => createAuthClient({ coordinate: typeof navigator !== 'undefined' && navigator.locks
    ? work => navigator.locks.request('temuevent-auth', work) : undefined }))
  const [email, setEmail] = useState(''), [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      const user = await client.login({ email, password })
      setPassword('')
      if (user.role !== 'ORGANIZER') { setError('Pembuatan event memerlukan akun organizer.'); return }
      router.replace('/organizer/events/new')
    } catch (failure) { setError(accountError(failure)) }
    finally { setBusy(false) }
  }
  return <main className="min-h-screen bg-[#fcf9ff] px-5 py-16 text-[#17143c]">
    <div className="mx-auto max-w-md rounded-2xl border border-[#e7e2f2] bg-white p-7 shadow-sm">
      <a href="/" className="font-bold text-[#5148df]">TemuEvent</a>
      <h1 className="mt-6 text-2xl font-bold">Masuk sebagai organizer</h1>
      <p className="mt-2 text-sm text-slate-600">Gunakan akun TemuEvent untuk membuat event.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div><label htmlFor="login-email" className="block text-sm font-semibold">Email</label>
          <input id="login-email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></div>
        <div><label htmlFor="login-password" className="block text-sm font-semibold">Kata sandi</label>
          <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></div>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#5148df] px-4 py-3 font-bold text-white disabled:opacity-60">{busy ? 'Sedang masuk…' : 'Masuk'}</button>
      </form>
    </div>
  </main>
}
