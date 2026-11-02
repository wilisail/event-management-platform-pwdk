import { Suspense } from 'react'
import { AuthForm } from '../../components/auth-form'

export default function RegisterPage() {
  return <Suspense fallback={<p className="width main" role="status">Memuat pendaftaran…</p>}><AuthForm mode="register" /></Suspense>
}
