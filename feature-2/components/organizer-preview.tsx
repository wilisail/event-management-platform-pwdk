'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { OrganizerView } from '../contracts/types'
import { loadOrganizer } from '../lib/api-client'
import { Brand } from './brand'

export function OrganizerPreview({ organizerId }: { organizerId: string }) {
  const [organizer, setOrganizer] = useState<OrganizerView | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    setOrganizer(null)
    setError('')
    loadOrganizer(organizerId, controller.signal)
      .then(setOrganizer)
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : 'Gagal memuat organizer')
      })
    return () => controller.abort()
  }, [organizerId])
  return (
    <main className="width public-profile">
      <Brand />
      <p className="demo-label">Prototype F2 · profil organizer dari demo API</p>
      {error ? (
        <div role="alert" className="panel">
          <h1>Profil tidak ditemukan</h1>
          <p>{error}</p>
          <Link href="/" className="link">
            Kembali ke akun
          </Link>
        </div>
      ) : !organizer ? (
        <p role="status">Memuat profil…</p>
      ) : (
        <>
          <section className="panel public-hero">
            <div className="avatar" aria-hidden="true">
              JC
            </div>
            <p className="eyebrow">EVENT ORGANIZER</p>
            <h1>{organizer.name}</h1>
            <p>{organizer.bio}</p>
          </section>
          <section className="panel">
            <h2>Ulasan & rating</h2>
            {organizer.ratingSummary ? (
              <p>
                {organizer.ratingSummary.average} / 5 · {organizer.ratingSummary.count} ulasan
              </p>
            ) : (
              <p>Belum ada ulasan yang terhubung. Data rating akan berasal dari fitur review F1.</p>
            )}
          </section>
          <Link href="/" className="link">
            ← Kembali ke akun
          </Link>
        </>
      )}
    </main>
  )
}
