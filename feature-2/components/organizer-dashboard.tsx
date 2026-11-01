'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { AttendeePurchaseView, EventSummaryView, PageView } from '../contracts/types'
import { accountError } from '../lib/auth-client'
import { date, money } from '../lib/format'
import { useAuth } from './auth-provider'
import { AccountFrame, ProtectedPage } from './account-shell'

function Pager({ page, pages, change }: { page: number; pages: number; change: (page: number) => void }) {
  if (pages <= 1) return null
  return <div className="auth-actions pager"><button className="secondary" disabled={page <= 1} onClick={() => change(page - 1)}>Sebelumnya</button>
    <span>Halaman {page} dari {pages}</span><button className="secondary" disabled={page >= pages} onClick={() => change(page + 1)}>Berikutnya</button></div>
}
function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return <div className="auth-error" role="alert"><p>{message}</p><div className="auth-actions">
    <button className="secondary" onClick={retry}>Coba lagi</button><Link className="link" href="/login">Masuk ulang</Link></div></div>
}
function OrganizerContent() {
  const { user, client } = useAuth()
  const [events, setEvents] = useState<PageView<EventSummaryView> | null>(null)
  const [eventError, setEventError] = useState(''), [eventPage, setEventPage] = useState(1), [eventRetry, setEventRetry] = useState(0)
  const [selected, setSelected] = useState<EventSummaryView | null>(null)
  const [attendees, setAttendees] = useState<PageView<AttendeePurchaseView> | null>(null)
  const [attendeeError, setAttendeeError] = useState(''), [attendeePage, setAttendeePage] = useState(1), [attendeeRetry, setAttendeeRetry] = useState(0)
  useEffect(() => {
    const abort = new AbortController()
    setEvents(null); setEventError(''); setSelected(null)
    client.get<PageView<EventSummaryView>>('/api/organizer/events?page=' + eventPage, abort.signal)
      .then(value => { if (!abort.signal.aborted) setEvents(value) })
      .catch(error => { if (!abort.signal.aborted) setEventError(accountError(error)) })
    return () => abort.abort()
  }, [client, eventPage, eventRetry])
  useEffect(() => {
    if (!selected) { setAttendees(null); return }
    const abort = new AbortController()
    setAttendees(null); setAttendeeError('')
    client.get<PageView<AttendeePurchaseView>>('/api/organizer/events/' + encodeURIComponent(selected.id) + '/attendees?page=' + attendeePage, abort.signal)
      .then(value => { if (!abort.signal.aborted) setAttendees(value) })
      .catch(error => { if (!abort.signal.aborted) setAttendeeError(accountError(error)) })
    return () => abort.abort()
  }, [client, selected, attendeePage, attendeeRetry])
  return <main className="width main"><div className="page-title"><p className="eyebrow">DASHBOARD ORGANIZER</p>
    <h1>Halo, {user?.name}.</h1><p>Event dan pendaftaran yang terhubung dengan akunmu.</p></div>
    <section className="panel"><div className="section-title"><div><p className="eyebrow">EVENT SAYA</p><h2>Ruang untuk pengalaman berikutnya.</h2></div>
      {events && <span className="badge">{events.pagination.total} event</span>}</div>
      {eventError ? <LoadError message={eventError} retry={() => setEventRetry(value => value + 1)} />
        : !events ? <p role="status">Memuat event…</p>
        : events.items.length === 0 ? <div className="empty-state"><h3>Belum ada event.</h3><p>Event milik akun ini akan tampil di sini setelah dibuat.</p></div>
        : <div className="owned-events">{events.items.map(event => <article key={event.id} className="owned-event">
          <div><span className="badge">{event.status}</span><h3>{event.name}</h3><p>{date(event.startAt)} · {event.location}</p></div>
          <button className={selected?.id === event.id ? 'primary' : 'secondary'} onClick={() => { setSelected(event); setAttendeePage(1) }}>Lihat peserta</button>
        </article>)}</div>}
      {events && <Pager page={eventPage} pages={events.pagination.totalPages} change={setEventPage} />}
    </section>
    <section className="panel organizer-attendees" aria-label="Daftar peserta"><p className="eyebrow">PENDAFTARAN TERKONFIRMASI</p>
      <h2>{selected ? selected.name : 'Daftar peserta'}</h2>
      {!selected ? <p>Pilih event untuk melihat pendaftaran yang telah terkonfirmasi.</p>
        : attendeeError ? <LoadError message={attendeeError} retry={() => setAttendeeRetry(value => value + 1)} />
        : !attendees ? <p role="status">Memuat peserta…</p>
        : attendees.items.length === 0 ? <p>Belum ada pendaftaran terkonfirmasi pada halaman ini.</p>
        : <div className="table-scroll" tabIndex={0} role="region" aria-label="Tabel peserta terkonfirmasi"><table className="attendee-table"><thead><tr>
          <th scope="col">Nama</th><th scope="col">Tiket</th><th scope="col">Total dibayar</th><th scope="col">Referensi</th>
        </tr></thead><tbody>{attendees.items.map(row => <tr key={row.purchaseId}><td>{row.name}</td><td>{row.ticketQuantity}</td><td>{money(row.totalPaid)}</td><td>{row.purchaseReference}</td></tr>)}</tbody></table></div>}
      {attendees && <Pager page={attendeePage} pages={attendees.pagination.totalPages} change={setAttendeePage} />}
      <p className="help">Daftar ini menampilkan pendaftaran terkonfirmasi. Kehadiran di lokasi dicatat terpisah.</p>
    </section>
  </main>
}
export function OrganizerDashboard() {
  return <AccountFrame><ProtectedPage role="ORGANIZER"><OrganizerContent /></ProtectedPage></AccountFrame>
}
