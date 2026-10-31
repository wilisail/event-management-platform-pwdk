'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { DemoPersona, UserView, WalletView } from '../contracts/types'
import { loadAccount } from '../lib/api-client'
import { UiLogo } from './ui-logo'
import { date, money, number } from '../lib/format'

type Tab = 'profile' | 'rewards' | 'referral'
const tabs: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profil saya' },
  { id: 'rewards', label: 'Poin & kupon' },
  { id: 'referral', label: 'Referral' },
]

export function AccountPreview() {
  const [persona, setPersona] = useState<DemoPersona>('customer')
  const [tab, setTab] = useState<Tab>('rewards')
  const [account, setAccount] = useState<{ user: UserView; rewards: WalletView | null } | null>(
    null,
  )
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [retry, setRetry] = useState(0)
  const confirm = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const controller = new AbortController()
    setAccount(null)
    setError('')
    setNotice('')
    loadAccount(persona, controller.signal)
      .then((value) => {
        setAccount(value)
        setName(value.user.name)
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : 'Gagal memuat akun')
      })
    return () => controller.abort()
  }, [persona, retry])
  const selectPersona = (value: DemoPersona) => {
    setPersona(value)
    setTab(value === 'organizer' ? 'profile' : 'rewards')
  }
  const copyCode = async () => {
    if (!account) return
    try {
      await navigator.clipboard.writeText(account.user.referralCode)
      setNotice('Kode referral disalin.')
    } catch {
      setNotice('Salin kode referral yang ditampilkan di bawah.')
    }
  }
  return (
    <div>
      <header className="header">
        <div className="width flex items-center justify-between gap-3">
          <UiLogo />
          <a className="link" href={process.env.NEXT_PUBLIC_F1_ORIGIN || 'http://localhost:3000'}>
            Jelajahi event ↗
          </a>
        </div>
      </header>
      <div className="demo">
        <div className="width flex flex-wrap items-center justify-between gap-3">
          <p>
            <strong>Pratinjau UI</strong> · Identitas dan rewards di halaman ini menggunakan data contoh.
          </p>
          <div className="persona" role="group" aria-label="Pilih akun demo">
            <button onClick={() => selectPersona('customer')} aria-pressed={persona === 'customer'}>
              Customer
            </button>
            <button
              onClick={() => selectPersona('organizer')}
              aria-pressed={persona === 'organizer'}
            >
              Organizer
            </button>
          </div>
        </div>
      </div>
      <main className="width main">
        <div className="page-title">
          <p className="eyebrow">AKUN & KOMUNITAS</p>
          <h1>Pengalaman seru, lebih personal.</h1>
          <p>Kelola profil, bagikan referral, dan lihat rewards untuk event berikutnya.</p>
        </div>
        <div className="layout">
          <aside className="sidebar">
            <div className="avatar" aria-hidden="true">
              {account?.user.name.slice(0, 1) || '·'}
            </div>
            <h2>{account?.user.name || 'Memuat akun…'}</h2>
            <span className="badge">{persona === 'customer' ? 'Customer' : 'Event organizer'}</span>
            <nav aria-label="Menu akun">
              {tabs
                .filter((item) => persona === 'customer' || item.id !== 'rewards')
                .map((item) => (
                  <button
                    key={item.id}
                    className={tab === item.id ? 'selected' : ''}
                    aria-pressed={tab === item.id}
                    onClick={() => {
                      setTab(item.id)
                      setNotice('')
                    }}
                  >
                    {item.label}
                    <span aria-hidden="true">→</span>
                  </button>
                ))}
            </nav>
            <Link href="/organizers/demo-organizer-001" className="link organizer-link">
              Lihat profil organizer ↗
            </Link>
          </aside>
          <section className="content" aria-label="Isi akun">
            {notice && (
              <p className="notice" role="status">
                {notice}
              </p>
            )}
            {error ? (
              <div className="panel" role="alert">
                <h2>Data belum dapat dimuat</h2>
                <p>{error}</p>
                <p>
                  Jalankan web dan demo API dengan <code>npm run dev</code>.
                </p>
                <button className="primary" onClick={() => setRetry((value) => value + 1)}>
                  Coba lagi
                </button>
              </div>
            ) : !account ? (
              <div className="panel" role="status">
                Memuat profil dan rewards…
              </div>
            ) : (
              <>
                {tab === 'profile' && (
                  <div className="panel">
                    <div className="section-title">
                      <div>
                        <p className="eyebrow">PROFIL</p>
                        <h2>Kenalan lebih dekat.</h2>
                      </div>
                      <span className="badge">Pratinjau</span>
                    </div>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault()
                        confirm.current?.showModal()
                      }}
                      className="profile-form"
                    >
                      <label>
                        Nama tampilan
                        <input
                          required
                          maxLength={80}
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          autoComplete="name"
                        />
                      </label>
                      <label>
                        Email
                        <input type="email" value={account.user.email} readOnly />
                      </label>
                      <div className="form-grid">
                        <label>
                          Peran
                          <input value={account.user.role} readOnly />
                        </label>
                        <label>
                          Kode referral tetap
                          <input value={account.user.referralCode} readOnly />
                        </label>
                      </div>
                      <p className="help">
                        Perubahan nama di prototype hanya berlaku pada halaman ini.
                      </p>
                      <button className="primary" type="submit">
                        Simpan pratinjau profil
                      </button>
                    </form>
                  </div>
                )}
                {tab === 'rewards' && account.rewards && <Rewards wallet={account.rewards} />}
                {tab === 'referral' && (
                  <>
                    <div className="referral-hero">
                      <p className="eyebrow">LEBIH SERU BERSAMA</p>
                      <h2>
                        Ajak teman.
                        <br />
                        Kumpulkan pengalaman.
                      </h2>
                      <p>
                        Teman yang mendaftar memakai kodemu mendapat kupon. Kamu mendapat 10.000
                        poin.
                      </p>
                      <div className="copy">
                        <code>{account.user.referralCode}</code>
                        <button onClick={copyCode}>Salin kode</button>
                      </div>
                    </div>
                    <div className="panel">
                      <h3>Rewards dengan masa berlaku yang jelas</h3>
                      <p>
                        Setiap bonus poin berlaku 3 bulan sejak diberikan. Kupon referral juga
                        berlaku 3 bulan. Kode referral akun tidak dapat diubah.
                      </p>
                      <p className="help">
                        Nominal kupon Rp25.000 pada demo mengikuti contoh checkout F1; belum menjadi
                        keputusan final.
                      </p>
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </main>
      <footer className="width footer">
        TemuEvent · Prototype Feature 2 · Tema mengikuti prototype Feature 1 oleh Rizky.
      </footer>
      <dialog ref={confirm} className="confirm-dialog" aria-labelledby="confirm-title">
        <h2 id="confirm-title">Simpan perubahan pratinjau?</h2>
        <p>
          Nama tampilan: <strong>{name.trim()}</strong>
        </p>
        <p>Data demo API tetap sama.</p>
        <div className="flex flex-wrap gap-3">
          <button className="secondary" onClick={() => confirm.current?.close()}>
            Kembali
          </button>
          <button
            className="primary"
            onClick={() => {
              if (!name.trim()) {
                confirm.current?.close()
                setNotice('Nama tidak boleh kosong.')
                return
              }
              setAccount((current) =>
                current ? { ...current, user: { ...current.user, name: name.trim() } } : current,
              )
              setNotice('Pratinjau profil diperbarui pada halaman ini.')
              confirm.current?.close()
            }}
          >
            Simpan pratinjau
          </button>
        </div>
      </dialog>
    </div>
  )
}

function Rewards({ wallet }: { wallet: WalletView }) {
  return (
    <>
      <div className="wallet-hero">
        <div>
          <p>POIN TERSEDIA</p>
          <h2>
            {number(wallet.availablePoints)} <span>poin</span>
          </h2>
          <p>Setara {money(wallet.availablePoints)} untuk potongan tiket.</p>
        </div>
        <div className="wallet-mark" aria-hidden="true">
          ✦
        </div>
      </div>
      <div className="panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">REWARD COUPONS</p>
            <h2>Bekal untuk event berikutnya.</h2>
          </div>
          <span className="badge">Contoh nominal</span>
        </div>
        <div className="coupons">
          {wallet.coupons.length ? (
            wallet.coupons.map((coupon) => (
              <article
                key={coupon.id}
                className={`coupon ${coupon.status !== 'AVAILABLE' ? 'inactive' : ''}`}
              >
                <span className="badge">
                  {coupon.status === 'AVAILABLE'
                    ? 'Tersedia'
                    : coupon.status === 'EXPIRED'
                      ? 'Kedaluwarsa'
                      : 'Terpakai'}
                </span>
                <h3>{money(coupon.discountValue)}</h3>
                <code>{coupon.code}</code>
                <p>Berlaku sampai {date(coupon.expiresAt)}</p>
              </article>
            ))
          ) : (
            <p>Belum ada kupon.</p>
          )}
        </div>
        <p className="help">
          Kupon aplikasi dapat berlaku lintas event. Kombinasi dengan voucher event dan poin akan
          disepakati bersama.
        </p>
      </div>
      <div className="panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">RIWAYAT POIN</p>
            <h2>Setiap bonus punya waktunya.</h2>
          </div>
        </div>
        <ul className="grants">
          {wallet.pointGrants.map((grant) => {
            const expired = new Date(grant.expiresAt).getTime() <= new Date(wallet.asOf).getTime()
            return (
              <li key={grant.id}>
                <div>
                  <strong>Bonus referral</strong>
                  <p>
                    Diberikan {date(grant.creditedAt)} · berakhir {date(grant.expiresAt)}
                  </p>
                </div>
                <div>
                  <strong>+{number(grant.amount)}</strong>
                  <span className={`grant-status ${expired ? 'expired' : ''}`}>
                    {expired ? 'Kedaluwarsa' : 'Aktif'}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}
