import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TemuEvent · Akun & Rewards',
  description: 'Prototype fitur 2: profil, referral, poin, kupon, dan data penghubung checkout.',
}

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
