'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from './auth-provider'
import { AccountFrame, ProtectedPage } from './account-shell'
import { ReferralSummary, RewardWallet } from './reward-panels'
import { ProfileEditor } from './profile-editor'
import { ProfileAvatar } from './profile-avatar'
import { PasswordEditor } from './password-editor'

type Tab = 'profile' | 'referral' | 'rewards' | 'security'
function AccountContent() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('profile'), [notice, setNotice] = useState('')
  useEffect(() => {
    const readTab = () => {
      const value = window.location.hash.slice(1)
      setTab(value === 'referral' || value === 'security' || (value === 'rewards' && user?.role === 'CUSTOMER') ? value : 'profile')
      setNotice('')
    }
    readTab()
    window.addEventListener('hashchange', readTab)
    return () => window.removeEventListener('hashchange', readTab)
  }, [user?.id, user?.role])
  if (!user) return null
  const copy = async () => {
    try { await navigator.clipboard.writeText(user.referralCode); setNotice('Kode referral disalin.') }
    catch { setNotice('Pilih dan salin kode referral yang ditampilkan.') }
  }
  return <main className="width main"><div className="page-title"><p className="eyebrow">AKUN & KOMUNITAS</p>
    <h1>Pengalaman seru, lebih personal.</h1><p>Profil dan kode referral dari akunmu.</p></div>
    <div className="layout"><aside className="sidebar">
      <ProfileAvatar name={user.name} url={user.profilePictureUrl} /><h2>{user.name}</h2>
      <span className="badge">{user.role === 'CUSTOMER' ? 'Customer' : 'Event organizer'}</span>
      <nav aria-label="Menu akun">{([{ id: 'profile', label: 'Profil saya' }, { id: 'referral', label: 'Referral' },
        ...(user.role === 'CUSTOMER' ? [{ id: 'rewards', label: 'Poin & kupon' }] : []),
        { id: 'security', label: 'Keamanan' }] as { id: Tab; label: string }[]).map(item =>
        <button key={item.id} className={tab === item.id ? 'selected' : ''} aria-pressed={tab === item.id}
          onClick={() => { setTab(item.id); setNotice(''); window.history.replaceState(window.history.state, '', '#' + item.id) }}>{item.label}<span aria-hidden="true">→</span></button>)}</nav>
      {user.role === 'ORGANIZER' && <Link className="link organizer-link" href="/organizer">Buka dashboard organizer ↗</Link>}
    </aside><section id={tab} className="content" aria-label="Isi akun">
      {notice && <p className="notice" role="status">{notice}</p>}
      {tab === 'profile' && <ProfileEditor key={user.id} user={user} />}
      {tab === 'security' && <PasswordEditor key={user.id} />}
      {tab === 'referral' && <><div className="referral-hero"><p className="eyebrow">LEBIH SERU BERSAMA</p>
        <h2>Undang teman, kumpulkan poin.</h2><p>Bagikan kodemu kepada teman yang belum memiliki akun. Teman memasukkannya sekali saat mendaftar.</p>
        <div className="copy"><code>{user.referralCode}</code><button onClick={copy}>Salin kode</button></div></div>
        <ReferralSummary key={user.id} /></>}
      {tab === 'rewards' && user.role === 'CUSTOMER' && <RewardWallet key={user.id} />}
    </section></div></main>
}
export function AccountDashboard() {
  return <AccountFrame><ProtectedPage><AccountContent /></ProtectedPage></AccountFrame>
}
