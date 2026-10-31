'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from './auth-provider'
import { AccountFrame, ProtectedPage } from './account-shell'
import { ReferralSummary, RewardWallet } from './reward-panels'

type Tab = 'profile' | 'referral' | 'rewards'
function AccountContent() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('profile'), [notice, setNotice] = useState('')
  if (!user) return null
  const copy = async () => {
    try { await navigator.clipboard.writeText(user.referralCode); setNotice('Kode referral disalin.') }
    catch { setNotice('Pilih dan salin kode referral yang ditampilkan.') }
  }
  return <main className="width main"><div className="page-title"><p className="eyebrow">AKUN & KOMUNITAS</p>
    <h1>Pengalaman seru, lebih personal.</h1><p>Profil dan kode referral dari akunmu.</p></div>
    <div className="layout"><aside className="sidebar">
      <div className="avatar" aria-hidden="true">{user.name.slice(0, 1)}</div><h2>{user.name}</h2>
      <span className="badge">{user.role === 'CUSTOMER' ? 'Customer' : 'Event organizer'}</span>
      <nav aria-label="Menu akun">{([{ id: 'profile', label: 'Profil saya' }, { id: 'referral', label: 'Referral' },
        ...(user.role === 'CUSTOMER' ? [{ id: 'rewards', label: 'Poin & kupon' }] : [])] as { id: Tab; label: string }[]).map(item =>
        <button key={item.id} className={tab === item.id ? 'selected' : ''} aria-pressed={tab === item.id}
          onClick={() => { setTab(item.id); setNotice('') }}>{item.label}<span aria-hidden="true">→</span></button>)}</nav>
      {user.role === 'ORGANIZER' && <Link className="link organizer-link" href="/organizer">Buka dashboard organizer ↗</Link>}
    </aside><section className="content" aria-label="Isi akun">
      {notice && <p className="notice" role="status">{notice}</p>}
      {tab === 'profile' && <div className="panel"><div className="section-title"><div>
        <p className="eyebrow">PROFIL</p><h2>Kenalan lebih dekat.</h2></div><span className="badge">Akun terhubung</span></div>
        <div className="profile-form"><label>Nama tampilan<input value={user.name} readOnly /></label>
          <label>Email<input value={user.email} readOnly /></label><div className="form-grid">
            <label>Peran<input value={user.role === 'CUSTOMER' ? 'Customer' : 'Organizer'} readOnly /></label>
            <label>Kode referral tetap<input value={user.referralCode} readOnly /></label></div>
          <p className="help">Pengeditan profil dan foto akan tersedia pada pembaruan berikutnya.</p>
        </div></div>}
      {tab === 'referral' && <><div className="referral-hero"><p className="eyebrow">LEBIH SERU BERSAMA</p>
        <h2>Kode untuk komunitasmu.</h2><p>Kode referral akunmu bersifat tetap dan dapat disalin.</p>
        <div className="copy"><code>{user.referralCode}</code><button onClick={copy}>Salin kode</button></div></div>
        <ReferralSummary key={user.id} /></>}
      {tab === 'rewards' && user.role === 'CUSTOMER' && <RewardWallet key={user.id} />}
    </section></div></main>
}
export function AccountDashboard() {
  return <AccountFrame><ProtectedPage><AccountContent /></ProtectedPage></AccountFrame>
}
