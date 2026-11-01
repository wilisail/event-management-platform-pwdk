'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { OrganizerView } from '../contracts/types'
import { UiLogo } from './ui-logo'
import { ProfileAvatar } from './profile-avatar'

export function OrganizerProfile({ organizerId }: { organizerId: string }) {
  const [profile, setProfile] = useState<OrganizerView | null>(null), [error, setError] = useState('')
  useEffect(() => {
    const abort = new AbortController()
    setProfile(null); setError('')
    void fetch('/api/organizers/' + encodeURIComponent(organizerId), { signal: abort.signal, cache: 'no-store' })
      .then(async response => {
        const body = await response.json()
        if (!response.ok || !body.success) throw new Error(response.status === 404 ? 'Profil organizer tidak ditemukan.' : 'Profil belum dapat dimuat. Silakan coba lagi.')
        if (!abort.signal.aborted) setProfile(body.data)
      }).catch(reason => { if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : 'Profil belum dapat dimuat.') })
    return () => abort.abort()
  }, [organizerId])
  return <main className="width public-profile"><UiLogo />
    {error ? <div className="panel public-hero" role="alert"><h1>Profil belum tersedia</h1><p>{error}</p></div>
      : !profile ? <p role="status">Memuat profil…</p> : <>
        <section className="panel public-hero"><ProfileAvatar name={profile.name} url={profile.profilePictureUrl} />
          <p className="eyebrow">EVENT ORGANIZER</p><h1>{profile.name}</h1>{profile.bio && <p>{profile.bio}</p>}</section>
        <section className="panel"><h2>Ulasan & rating</h2>{profile.ratingSummary
          ? <p>{profile.ratingSummary.average} / 5 · {profile.ratingSummary.count} ulasan</p>
          : <p>Ulasan belum tersedia.</p>}</section>
      </>}
    <Link className="link" href="/account">← Kembali ke akun</Link>
  </main>
}
