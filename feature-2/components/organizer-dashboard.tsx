'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  PURCHASE_STATUSES, type AttendeePurchaseView, type EventSummaryView, type OrganizerDecision, type OrganizerTransactionDetail,
  type OrganizerTransactionView, type PageView, type PurchaseStatus,
} from '../contracts/types'
import { accountError, AuthApiError } from '../lib/auth-client'
import { featureOneUrl } from '../lib/feature-one-links'
import { date, dateTime, money } from '../lib/format'
import { useAuth } from './auth-provider'
import { AccountFrame, ProtectedPage } from './account-shell'
import { OrganizerStatistics } from './organizer-statistics'

function Pager({ page, pages, change, busy = false }: { page: number; pages: number; change: (page: number) => void; busy?: boolean }) {
  if (pages <= 1) return null
  return <div className="auth-actions pager"><button className="secondary" disabled={busy || page <= 1} onClick={() => change(page - 1)}>Sebelumnya</button>
    <span>Halaman {page} dari {pages}</span><button className="secondary" disabled={busy || page >= pages} onClick={() => change(page + 1)}>Berikutnya</button></div>
}
function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return <div className="auth-error" role="alert"><p>{message}</p><div className="auth-actions">
    <button className="secondary" onClick={retry}>Coba lagi</button><Link className="link" href="/login">Masuk ulang</Link></div></div>
}

const purchaseStatusLabel: Record<PurchaseStatus, string> = {
  WAITING_FOR_PAYMENT: 'Menunggu pembayaran',
  WAITING_FOR_ADMIN_CONFIRMATION: 'Menunggu konfirmasi organizer',
  DONE: 'Selesai',
  REJECTED: 'Ditolak',
  EXPIRED: 'Kedaluwarsa',
  CANCELED: 'Dibatalkan',
}

function TransactionDetail({ id, onRefreshList }: { id: string; onRefreshList: () => void }) {
  const { client } = useAuth()
  const [transaction, setTransaction] = useState<OrganizerTransactionDetail | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [decisionNotice, setDecisionNotice] = useState<{ message: string; error: boolean } | null>(null)
  const [deciding, setDeciding] = useState(false)
  const detail = useRef<HTMLElement>(null)

  useEffect(() => { detail.current?.focus() }, [])

  useEffect(() => {
    const abort = new AbortController()
    client.get<OrganizerTransactionDetail>('/api/organizer/transactions/' + encodeURIComponent(id), abort.signal)
      .then(value => { if (!abort.signal.aborted) setTransaction(value) })
      .catch(reason => { if (!abort.signal.aborted) setError(accountError(reason)) })
    return () => abort.abort()
  }, [client, id, retry])

  const refresh = () => {
    setTransaction(null)
    setRetry(value => value + 1)
    onRefreshList()
  }
  const decide = async (decision: OrganizerDecision) => {
    if (deciding || transaction?.decisionAvailability !== 'READY') return
    const question = decision === 'ACCEPT' ? 'Terima pembayaran transaksi ini?' : 'Tolak pembayaran transaksi ini?'
    if (!window.confirm(question)) return
    setDeciding(true)
    setDecisionNotice(null)
    try {
      const result = await client.decideTransaction(id, decision)
      setDecisionNotice({ message: result.status === 'DONE' ? 'Pembayaran diterima.' : 'Pembayaran ditolak.', error: false })
      refresh()
    } catch (reason) {
      setDecisionNotice({ message: accountError(reason), error: true })
      if (reason instanceof AuthApiError && (reason.status === 404 || reason.status === 409 ||
        ['DECISION_UNCERTAIN', 'DECISION_UNAVAILABLE'].includes(reason.code))) refresh()
    } finally { setDeciding(false) }
  }

  return <section ref={detail} tabIndex={-1} className="organizer-transaction-detail" aria-label="Detail transaksi">
    {decisionNotice && <p role={decisionNotice.error ? 'alert' : 'status'}>{decisionNotice.message}</p>}
    {error ? <LoadError message={error} retry={() => { setError(''); setRetry(value => value + 1) }} />
      : !transaction ? <p role="status">Memuat detail transaksi…</p> : <>
        <h3>Transaksi {transaction.reference}</h3>
        <p>{transaction.eventName} · {transaction.customerName}</p>
        <span className="badge">{purchaseStatusLabel[transaction.status]}</span>
        <dl className="transaction-fields">
          <div><dt>Dibuat</dt><dd>{dateTime(transaction.createdAt)}</dd></div>
          {transaction.paymentDueAt && <div><dt>Batas pembayaran</dt><dd>{dateTime(transaction.paymentDueAt)}</dd></div>}
          {transaction.decisionDueAt && <div><dt>Batas konfirmasi</dt><dd>{dateTime(transaction.decisionDueAt)}</dd></div>}
          {transaction.completedAt && <div><dt>Diselesaikan</dt><dd>{dateTime(transaction.completedAt)}</dd></div>}
        </dl>
        {transaction.items.length > 0 && <div className="table-scroll" tabIndex={0} role="region" aria-label="Rincian tiket">
          <table className="attendee-table"><thead><tr>
            <th scope="col">Tiket</th><th scope="col">Jumlah</th><th scope="col">Harga satuan</th><th scope="col">Total</th>
          </tr></thead><tbody>{transaction.items.map(item => <tr key={item.id}>
            <td>{item.ticketName}</td><td>{item.quantity}</td><td>{money(item.unitPrice)}</td><td>{money(item.lineTotal)}</td>
          </tr>)}</tbody></table>
        </div>}
        <dl className="transaction-fields">
          <div><dt>Subtotal</dt><dd>{money(transaction.subtotal)}</dd></div>
          <div><dt>Diskon voucher</dt><dd>{money(transaction.voucherDiscount)}</dd></div>
          <div><dt>Diskon kupon</dt><dd>{money(transaction.couponDiscount)}</dd></div>
          <div><dt>Potongan poin</dt><dd>{money(transaction.pointsUsed)}</dd></div>
          <div><dt>Total transaksi</dt><dd>{money(transaction.totalPrice)}</dd></div>
        </dl>
        <h4>Bukti pembayaran</h4>
        <p>{transaction.proofUploadedAt
          ? `Tercatat diunggah pada ${dateTime(transaction.proofUploadedAt)}.`
          : 'Belum ada unggahan bukti pembayaran yang tercatat.'}</p>
        {transaction.proofUploadedAt && (transaction.proofAvailability === 'READY'
          ? <a className="secondary" href={`/api/organizer/transactions/${encodeURIComponent(transaction.id)}/proof`}
            target="_blank" rel="noopener noreferrer">Lihat bukti pembayaran</a>
          : <p>Akses berkas bukti pembayaran belum terhubung.</p>)}
        {transaction.decisionAvailability === 'READY' && <div className="auth-actions">
          <button className="primary" disabled={deciding} onClick={() => void decide('ACCEPT')}>Terima pembayaran</button>
          <button className="secondary" disabled={deciding} onClick={() => void decide('REJECT')}>Tolak pembayaran</button>
          {deciding && <span role="status">Menyimpan keputusan…</span>}
        </div>}
        {transaction.decisionAvailability === 'UNAVAILABLE' && <p>Konfirmasi pembayaran belum tersedia.</p>}
      </>}
  </section>
}

function TransactionList({ page, status, changePage, refreshStatistics, focusStatusFilter }: {
  page: number; status: PurchaseStatus | ''; changePage: (page: number) => void
  refreshStatistics: () => void; focusStatusFilter: () => void
}) {
  const { client } = useAuth()
  const [transactions, setTransactions] = useState<PageView<OrganizerTransactionView> | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const detailOpener = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const abort = new AbortController()
    const query = new URLSearchParams({ page: String(page) })
    if (status) query.set('status', status)
    client.get<PageView<OrganizerTransactionView>>('/api/organizer/transactions?' + query, abort.signal)
      .then(value => { if (!abort.signal.aborted) setTransactions(value) })
      .catch(reason => { if (!abort.signal.aborted) setError(accountError(reason)) })
    return () => abort.abort()
  }, [client, page, status, retry])

  if (error) return <LoadError message={error} retry={() => { setError(''); setRetry(value => value + 1) }} />
  if (!transactions) return <p role="status">Memuat transaksi…</p>
  if (page > Math.max(1, transactions.pagination.totalPages)) return <div className="empty-state">
    <p>Halaman transaksi ini sudah kosong.</p>
    <button className="secondary" onClick={() => changePage(1)}>Kembali ke halaman pertama</button>
  </div>

  return <>
    {transactions.items.length === 0 ? <p>Belum ada transaksi pada halaman ini.</p>
      : <div className="table-scroll" tabIndex={0} role="region" aria-label="Tabel transaksi event">
        <table className="attendee-table"><thead><tr>
          <th scope="col">Referensi</th><th scope="col">Event</th><th scope="col">Pembeli</th>
          <th scope="col">Status</th><th scope="col">Total</th><th scope="col">Detail</th>
        </tr></thead><tbody>{transactions.items.map(row => <tr key={row.id}>
          <td>{row.reference}</td><td>{row.eventName}</td><td>{row.customerName}</td>
          <td>{purchaseStatusLabel[row.status]}</td><td>{money(row.totalPrice)}</td>
          <td><button className="secondary" aria-expanded={selectedId === row.id}
            aria-label={`${selectedId === row.id ? 'Tutup' : 'Lihat'} detail transaksi ${row.reference}`}
            onClick={event => {
              detailOpener.current = event.currentTarget
              setSelectedId(current => current === row.id ? null : row.id)
            }}>
            {selectedId === row.id ? 'Tutup detail' : 'Lihat detail'}
          </button></td>
        </tr>)}</tbody></table>
      </div>}
    <Pager page={page} pages={transactions.pagination.totalPages} change={changePage} />
    {selectedId && <>
      <TransactionDetail key={selectedId} id={selectedId} onRefreshList={() => {
        setRetry(value => value + 1); refreshStatistics()
      }} />
      <button className="secondary" onClick={() => {
        setSelectedId(null)
        if (detailOpener.current?.isConnected) detailOpener.current.focus()
        else focusStatusFilter()
      }}>Tutup detail transaksi</button>
    </>}
  </>
}

function OrganizerTransactions({ refreshStatistics }: { refreshStatistics: () => void }) {
  const [status, setStatus] = useState<PurchaseStatus | ''>('')
  const [page, setPage] = useState(1)
  const statusFilter = useRef<HTMLSelectElement>(null)
  return <section className="panel organizer-attendees" aria-labelledby="organizer-transactions-title">
    <div className="section-title"><div><p className="eyebrow">PENJUALAN TIKET</p>
      <h2 id="organizer-transactions-title">Transaksi event</h2></div>
      <label className="transaction-filter">Status transaksi <select ref={statusFilter} value={status} onChange={event => {
        setStatus(event.target.value as PurchaseStatus | ''); setPage(1)
      }}>
        <option value="">Semua status</option>
        {PURCHASE_STATUSES.map(value => <option key={value} value={value}>{purchaseStatusLabel[value]}</option>)}
      </select></label>
    </div>
    <TransactionList key={`${status}:${page}`} status={status} page={page} changePage={setPage}
      refreshStatistics={refreshStatistics} focusStatusFilter={() => statusFilter.current?.focus()} />
  </section>
}

function OrganizerAttendees({ event }: { event: EventSummaryView }) {
  const { client } = useAuth()
  const [attendees, setAttendees] = useState<PageView<AttendeePurchaseView> | null>(null)
  const [error, setError] = useState(''), [page, setPage] = useState(1), [retry, setRetry] = useState(0)
  const [marking, setMarking] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null)
  const inFlight = useRef(false)

  useEffect(() => {
    const abort = new AbortController()
    client.get<PageView<AttendeePurchaseView>>('/api/organizer/events/' + encodeURIComponent(event.id) + '/attendees?page=' + page, abort.signal)
      .then(value => { if (!abort.signal.aborted) setAttendees(value) })
      .catch(reason => { if (!abort.signal.aborted) setError(accountError(reason)) })
    return () => abort.abort()
  }, [client, event.id, page, retry])

  const refresh = () => { setAttendees(null); setError(''); setRetry(value => value + 1) }
  const mark = async (row: AttendeePurchaseView) => {
    if (inFlight.current || row.attendedAt || !window.confirm(`Tandai ${row.name} sudah hadir?`)) return
    inFlight.current = true
    setMarking(row.purchaseId)
    setNotice(null)
    try {
      const record = await client.markAttendance(event.id, row.customerId, row.purchaseId)
      setAttendees(current => current && { ...current, items: current.items.map(item =>
        item.customerId === record.customerId ? { ...item, attendedAt: record.attendedAt } : item) })
      setNotice({ message: `Kehadiran ${row.name} tercatat.`, error: false })
    } catch (reason) {
      setNotice({ message: accountError(reason), error: true })
      if (reason instanceof AuthApiError && (reason.code === 'ATTENDANCE_UNCERTAIN' || reason.status === 404)) refresh()
    } finally { inFlight.current = false; setMarking(null) }
  }

  return <>
    {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.message}</p>}
    {error ? <LoadError message={error} retry={refresh} />
      : !attendees ? <p role="status">Memuat peserta…</p>
      : attendees.items.length === 0 ? <p>Belum ada pendaftaran terkonfirmasi pada halaman ini.</p>
      : <div className="table-scroll" tabIndex={0} role="region" aria-label="Tabel peserta terkonfirmasi"><table className="attendee-table"><thead><tr>
        <th scope="col">Nama</th><th scope="col">Tiket</th><th scope="col">Total dibayar</th><th scope="col">Referensi</th>
        <th scope="col">Kehadiran</th>
      </tr></thead><tbody>{attendees.items.map(row => <tr key={row.purchaseId}>
        <td>{row.name}</td><td>{row.ticketQuantity}</td><td>{money(row.totalPaid)}</td><td>{row.purchaseReference}</td>
        <td>{row.attendedAt ? <><span className="badge">Hadir</span> {dateTime(row.attendedAt)}</>
          : <button className="secondary" disabled={marking !== null} aria-label={`Tandai hadir: ${row.name}`}
            onClick={() => void mark(row)}>{marking === row.purchaseId ? 'Menyimpan…' : 'Tandai hadir'}</button>}</td>
      </tr>)}</tbody></table></div>}
    {attendees && <Pager page={page} pages={attendees.pagination.totalPages} busy={marking !== null} change={nextPage => {
      setAttendees(null); setError(''); setPage(nextPage)
    }} />}
  </>
}

function OrganizerContent() {
  const { user, client } = useAuth()
  const [statisticsRevision, setStatisticsRevision] = useState(0)
  const [events, setEvents] = useState<PageView<EventSummaryView> | null>(null)
  const [eventError, setEventError] = useState(''), [eventPage, setEventPage] = useState(1), [eventRetry, setEventRetry] = useState(0)
  const [selected, setSelected] = useState<EventSummaryView | null>(null)
  const createEventUrl = user?.role === 'ORGANIZER' && process.env.NEXT_PUBLIC_F1_MANAGEMENT_READY === 'true'
    && process.env.NEXT_PUBLIC_F1_ORIGIN ? featureOneUrl('/organizer/events/new') : null
  useEffect(() => {
    const abort = new AbortController()
    setEvents(null); setEventError(''); setSelected(null)
    client.get<PageView<EventSummaryView>>('/api/organizer/events?page=' + eventPage, abort.signal)
      .then(value => { if (!abort.signal.aborted) setEvents(value) })
      .catch(error => { if (!abort.signal.aborted) setEventError(accountError(error)) })
    return () => abort.abort()
  }, [client, eventPage, eventRetry])
  return <main className="width main"><div className="page-title"><p className="eyebrow">DASHBOARD ORGANIZER</p>
    <h1>Halo, {user?.name}.</h1><p>Event, transaksi, dan pendaftaran yang terhubung dengan akunmu.</p></div>
    <section className="panel"><div className="section-title"><div><p className="eyebrow">EVENT SAYA</p><h2>Ruang untuk pengalaman berikutnya.</h2></div>
      <div className="auth-actions">
        {events && <span className="badge">{events.pagination.total} event</span>}
        {user && <Link className="secondary" href={'/organizers/' + encodeURIComponent(user.id)}>Profil publik</Link>}
        {createEventUrl && <a className="primary" href={createEventUrl}>Buat event</a>}
      </div></div>
      {eventError ? <LoadError message={eventError} retry={() => setEventRetry(value => value + 1)} />
        : !events ? <p role="status">Memuat event…</p>
        : events.items.length === 0 ? <div className="empty-state"><h3>Belum ada event.</h3><p>Event milik akun ini akan tampil di sini setelah dibuat.</p></div>
        : <div className="owned-events">{events.items.map(event => {
          const eventUrl = event.status === 'PUBLISHED' ? featureOneUrl('/events/' + encodeURIComponent(event.id)) : null
          return <article key={event.id} className="owned-event">
            <div><span className="badge">{event.status}</span><h3>{event.name}</h3><p>{date(event.startAt)} · {event.location}</p></div>
            <div className="auth-actions">
              {eventUrl && <a className="link" href={eventUrl}>Lihat halaman publik</a>}
              <button className={selected?.id === event.id ? 'primary' : 'secondary'} onClick={() => setSelected(event)}>Lihat peserta</button>
            </div>
          </article>
        })}</div>}
      {events && <Pager page={eventPage} pages={events.pagination.totalPages} change={setEventPage} />}
    </section>
    <section className="panel organizer-attendees" aria-label="Daftar peserta"><p className="eyebrow">PENDAFTARAN TERKONFIRMASI</p>
      <h2>{selected ? selected.name : 'Daftar peserta'}</h2>
      {selected ? <OrganizerAttendees key={selected.id} event={selected} />
        : <p>Pilih event untuk melihat pendaftaran yang telah terkonfirmasi.</p>}
      <p className="help">Daftar ini menampilkan pendaftaran terkonfirmasi. Kehadiran di lokasi dicatat terpisah.</p>
    </section>
    <OrganizerTransactions refreshStatistics={() => setStatisticsRevision(value => value + 1)} />
    <OrganizerStatistics revision={statisticsRevision} />
  </main>
}
export function OrganizerDashboard() {
  const { user } = useAuth()
  return <AccountFrame><ProtectedPage role="ORGANIZER"><OrganizerContent key={user?.id} /></ProtectedPage></AccountFrame>
}
