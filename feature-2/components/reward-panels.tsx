'use client'

import { useEffect, useState } from 'react'
import type { AccountWalletView, PageView, ReferralSummaryView } from '../contracts/types'
import { accountError } from '../lib/auth-client'
import { date, money, number } from '../lib/format'
import { useAuth } from './auth-provider'

function useRewardRead<T>(path: string) {
  const { client, user } = useAuth()
  const userId = user?.id
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{ key: string; data?: T; error?: string } | null>(null)
  const key = JSON.stringify([userId, path, retry])
  useEffect(() => {
    if (!userId) return
    const abort = new AbortController()
    client.get<T>(path, abort.signal)
      .then(data => { if (!abort.signal.aborted) setResult({ key, data }) })
      .catch(error => { if (!abort.signal.aborted) setResult({ key, error: accountError(error) }) })
    return () => abort.abort()
  }, [client, key, path, userId])
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') setRetry(value => value + 1) }
    const timer = window.setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  const current = result?.key === key ? result : null
  return { data: current?.data, error: current?.error, reload: () => setRetry(value => value + 1) }
}

function ReadState({ error, reload }: { error?: string; reload: () => void }) {
  if (error) return <div className="panel" role="alert"><h2>Rewards belum dapat dimuat.</h2>
    <p>{error}</p><button className="secondary" onClick={reload}>Coba lagi</button></div>
  return <div className="panel" role="status">Memuat rewards akunmu…</div>
}

export function ReferralSummary() {
  const { data, error, reload } = useRewardRead<ReferralSummaryView>('/api/me/referral')
  if (!data) return <ReadState error={error} reload={reload} />
  return <div className="panel"><div className="section-title"><div>
    <p className="eyebrow">KOMUNITASMU</p><h2>{number(data.referredCount)} teman sudah bergabung.</h2>
  </div><button className="secondary" onClick={reload}>Perbarui</button></div>
    <p>Setiap teman yang mendaftar dengan kodemu mendapat kupon platform, dan kamu mendapat {number(data.referralAwardPoints)} poin.</p>
    <p className="help">Poin dan kupon berlaku {data.validityCalendarMonths} bulan sejak diberikan. Kode referral akunmu tetap sama.</p>
  </div>
}

export function RewardWallet() {
  const [pointPage, setPointPage] = useState(1), [couponPage, setCouponPage] = useState(1)
  const path = `/api/me/rewards?pointPage=${pointPage}&couponPage=${couponPage}&pageSize=10`
  const { data, error, reload } = useRewardRead<AccountWalletView>(path)
  if (!data) return <ReadState error={error} reload={reload} />
  return <WalletContent wallet={data} onPointPage={setPointPage} onCouponPage={setCouponPage} onReload={reload} />
}

const couponLabels = { AVAILABLE: 'Tersedia', RESERVED: 'Ditahan transaksi', USED: 'Terpakai', EXPIRED: 'Kedaluwarsa', PENDING: 'Belum berlaku' }
const pointLabels = { AVAILABLE: 'Aktif', EXPIRED: 'Kedaluwarsa', EMPTY: 'Tidak ada sisa', PENDING: 'Belum berlaku' }
const timestamp = (value: string) => new Intl.DateTimeFormat('id-ID', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
}).format(new Date(value)) + ' WIB'

export function WalletContent({ wallet, onPointPage, onCouponPage, onReload }: {
  wallet: AccountWalletView
  onPointPage: (page: number) => void
  onCouponPage: (page: number) => void
  onReload: () => void
}) {
  return <>
    <div className="wallet-hero"><div><p>POIN TERSEDIA</p>
      <h2>{number(wallet.availablePoints)} <span>poin</span></h2>
      <p>Setara {money(wallet.availablePoints)} untuk potongan tiket.</p>
    </div><div className="wallet-mark" aria-hidden="true">✦</div></div>
    <div className="section-title"><p className="help">Diperbarui {timestamp(wallet.asOf)}</p>
      <button className="secondary" onClick={onReload}>Perbarui saldo</button></div>
    <div className="panel"><div className="section-title"><div>
      <p className="eyebrow">KUPON PLATFORM</p><h2>Bekal untuk event berikutnya.</h2>
    </div><span className="badge">{number(wallet.availableCouponCount)} tersedia</span></div>
      <div className="coupons">{wallet.coupons.items.length ? wallet.coupons.items.map(coupon =>
        <article key={coupon.id} className={`coupon ${coupon.status !== 'AVAILABLE' ? 'inactive' : ''}`}>
          <span className="badge">{couponLabels[coupon.status]}</span><h3>{money(coupon.discountValue)}</h3>
          <code className="break-all">{coupon.code}</code><p>Berlaku sampai {timestamp(coupon.expiresAt)}</p>
        </article>) : <p className="empty-state">{wallet.coupons.pagination.total ? 'Tidak ada kupon pada halaman ini.' : 'Belum ada kupon. Kupon referral diterima saat mendaftar menggunakan kode teman.'}</p>}</div>
      <p className="help">Kupon platform berlaku lintas event. Kupon yang ditahan transaksi belum dapat digunakan kembali.</p>
      <HistoryPager name="kupon" page={wallet.coupons} onPage={onCouponPage} />
    </div>
    <div className="panel"><div className="section-title"><div>
      <p className="eyebrow">RIWAYAT POIN</p><h2>Setiap bonus punya waktunya.</h2>
    </div></div>
      {wallet.pointGrants.items.length ? <ul className="grants">{wallet.pointGrants.items.map(grant =>
        <li key={grant.id}><div><strong>Bonus referral</strong>
          <p>Diberikan {date(grant.creditedAt)} · berakhir {timestamp(grant.expiresAt)}</p>
          <p>Sisa bonus: {number(grant.remainingAmount)} poin</p>
        </div><div><strong>+{number(grant.amount)}</strong>
          <span className={`grant-status ${grant.status !== 'AVAILABLE' ? 'expired' : ''}`}>{pointLabels[grant.status]}</span>
        </div></li>)}</ul> : <p className="empty-state">{wallet.pointGrants.pagination.total ? 'Tidak ada bonus pada halaman ini.' : 'Belum ada bonus poin. Bagikan kode referralmu untuk mengundang teman.'}</p>}
      <p className="help">Saldo tersedia tidak mencakup poin yang kedaluwarsa atau sudah digunakan maupun ditahan transaksi.</p>
      <HistoryPager name="poin" page={wallet.pointGrants} onPage={onPointPage} />
    </div>
  </>
}

function HistoryPager<T>({ name, page, onPage }: { name: string; page: PageView<T>; onPage: (value: number) => void }) {
  const { pagination: p } = page
  if (!p.totalPages && p.page === 1) return null
  return <nav className="auth-actions pager" aria-label={`Halaman riwayat ${name}`}>
    <button className="secondary" disabled={p.page <= 1} onClick={() => onPage(p.page - 1)}>Sebelumnya</button>
    <span>Halaman {p.page} / {Math.max(1, p.totalPages)}</span>
    <button className="secondary" disabled={p.page >= p.totalPages || p.page >= 1000} onClick={() => onPage(p.page + 1)}>Berikutnya</button>
  </nav>
}
