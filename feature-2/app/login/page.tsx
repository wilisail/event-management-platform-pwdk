import { Suspense } from 'react'
import { AuthForm } from '../../components/auth-form'

export default function LoginPage() {
  return <Suspense fallback={<p className="width main" role="status">Memuat halaman masuk…</p>}><AuthForm mode="login" /></Suspense>
}
