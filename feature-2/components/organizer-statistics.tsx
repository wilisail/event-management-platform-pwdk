'use client'

import { useEffect, useState } from 'react'
import { STATISTICS_GROUPS, type OrganizerStatisticsView, type StatisticsGroup } from '../contracts/types'
import { accountError } from '../lib/auth-client'
import { date, money, number } from '../lib/format'
import { useAuth } from './auth-provider'

const groupLabel = { day: 'Harian', month: 'Bulanan', year: 'Tahunan' } as const
const dateLabel = (value: string, group: StatisticsGroup) => group === 'year' ? value.slice(0, 4)
  : new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', month: 'short',
    ...(group === 'day' ? { day: 'numeric' } : { year: '2-digit' }),
  }).format(new Date(value + 'T00:00:00Z'))
type Metric = 'revenueIdr' | 'ticketQuantity'

export function OrganizerStatistics({ revision }: { revision: number }) {
  const { client } = useAuth()
  const [group, setGroup] = useState<StatisticsGroup>('day')
  const [metric, setMetric] = useState<Metric>('revenueIdr')
  const [retry, setRetry] = useState(0)
  const requestKey = `${group}:${revision}:${retry}`
  const [response, setResponse] = useState<{ key: string; data?: OrganizerStatisticsView; error?: string }>()

  useEffect(() => {
    const abort = new AbortController()
    client.get<OrganizerStatisticsView>('/api/organizer/statistics?groupBy=' + group, abort.signal)
      .then(data => { if (!abort.signal.aborted) setResponse({ key: requestKey, data }) })
      .catch(error => { if (!abort.signal.aborted) setResponse({ key: requestKey, error: accountError(error) }) })
    return () => abort.abort()
  }, [client, group, requestKey])

  const current = response?.key === requestKey ? response : undefined
  const data = current?.data
  const largest = data ? Math.max(1, ...data.periods.map(period => period[metric])) : 1
  return <section className="panel organizer-attendees" aria-labelledby="organizer-statistics-title">
    <div className="section-title"><div><p className="eyebrow">KINERJA EVENT</p>
      <h2 id="organizer-statistics-title">Statistik penjualan</h2></div>
      <div className="auth-actions" role="group" aria-label="Kelompok waktu statistik">
        {STATISTICS_GROUPS.map(value => <button key={value} className={group === value ? 'primary' : 'secondary'}
          aria-pressed={group === value} onClick={() => setGroup(value)}>{groupLabel[value]}</button>)}
      </div>
    </div>
    <p className="help">Berdasarkan transaksi selesai dan tanggal penyelesaiannya (WIB).</p>
    {!current ? <p role="status">Memuat statistik…</p>
      : current.error ? <div className="auth-error" role="alert"><p>{current.error}</p>
        <button className="secondary" onClick={() => setRetry(value => value + 1)}>Coba lagi</button></div> : null}
    {data && <>
      <p>{date(data.from + 'T00:00:00+07:00')} – {date(data.to + 'T00:00:00+07:00')}</p>
      <dl className="transaction-fields">
        <div><dt>Pendapatan tiket</dt><dd>{money(data.totals.revenueIdr)}</dd></div>
        <div><dt>Transaksi selesai</dt><dd>{number(data.totals.purchaseCount)}</dd></div>
        <div><dt>Tiket terkonfirmasi</dt><dd>{number(data.totals.ticketQuantity)}</dd></div>
      </dl>
      {data.totals.purchaseCount === 0 ? <p>Belum ada transaksi selesai pada periode ini.</p> : <>
        <label className="transaction-filter">Tampilkan <select value={metric} onChange={event =>
          setMetric(event.target.value === 'ticketQuantity' ? 'ticketQuantity' : 'revenueIdr')}>
          <option value="revenueIdr">Pendapatan tiket</option><option value="ticketQuantity">Tiket terkonfirmasi</option>
        </select></label>
        <div className="statistics-chart-scroll" aria-hidden="true">
          <div className="statistics-chart" style={{ gridTemplateColumns: `repeat(${data.periods.length}, minmax(40px, 1fr))` }}>
            {data.periods.map(period => <div className="statistics-chart-column" key={period.startDate}>
              <div className="statistics-chart-track"><span style={{ height: `${period[metric] / largest * 100}%` }}
                title={metric === 'revenueIdr' ? money(period[metric]) : number(period[metric])} /></div>
              <span>{dateLabel(period.startDate, data.groupBy)}</span>
            </div>)}
          </div>
        </div>
        <details className="statistics-data"><summary>Lihat angka per periode</summary>
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Tabel statistik penjualan">
            <table className="attendee-table"><thead><tr><th scope="col">Periode</th><th scope="col">Pendapatan</th>
              <th scope="col">Transaksi</th><th scope="col">Tiket</th></tr></thead>
              <tbody>{data.periods.map(period => <tr key={period.startDate}><th scope="row">{dateLabel(period.startDate, data.groupBy)}</th>
                <td>{money(period.revenueIdr)}</td><td>{number(period.purchaseCount)}</td><td>{number(period.ticketQuantity)}</td></tr>)}</tbody>
            </table>
          </div>
        </details>
      </>}
    </>}
  </section>
}
