import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '../components/auth-provider'

export const metadata: Metadata = {
  title: 'TemuEvent · Akun & Rewards',
  description: 'Akun TemuEvent, login aman, profil dan dashboard organizer.',
}

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  )
}
