import type { LoginRequest, LoginSuccess, RegistrationRequest, RegistrationSuccess, UserView } from '../contracts/types'

export class AuthApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message)
    this.name = 'AuthApiError'
  }
}
type Coordinate = <T>(work: () => Promise<T>) => Promise<T>
type Options = {
  fetcher?: typeof fetch
  coordinate?: Coordinate
  onUnauthorized?: () => void
  onUncertain?: () => void
}

/** Own-app return routes only. Cross-feature checkout handoff is coordinated separately. */
export function safeReturnPath(value: string | null | undefined, fallback = '/account'): string {
  if (!value || /[\\\u0000-\u0020]/.test(value) || !value.startsWith('/') || value.startsWith('//')) return fallback
  try {
    const url = new URL(value, 'https://temuevent.invalid')
    return url.origin === 'https://temuevent.invalid' && ['/account', '/organizer'].includes(url.pathname)
      ? url.pathname + url.search : fallback
  } catch { return fallback }
}

export function createAuthClient(options: Options = {}) {
  const transport = options.fetcher ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
  let refreshFlight: Promise<boolean> | null = null
  let refreshUncertain = false
  const coordinated = <T>(work: () => Promise<T>) => options.coordinate ? options.coordinate(work) : work()

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = new URL(path, 'https://temuevent.invalid')
    if (url.origin !== 'https://temuevent.invalid' || !url.pathname.startsWith('/api/') || path.includes('\\')) {
      throw new AuthApiError(400, 'INVALID_API_PATH', 'Invalid application API path')
    }
    let response: Response
    try { response = await transport(path, { ...init, credentials: 'include', cache: 'no-store' }) }
    catch (error) {
      if (init.signal?.aborted) throw error
      throw new AuthApiError(0, 'NETWORK_UNAVAILABLE', 'Unable to reach the account service')
    }
    const body = await response.json().catch(() => null)
    if (!response.ok || !body?.success) throw new AuthApiError(response.status || 503,
      typeof body?.code === 'string' ? body.code : 'API_UNAVAILABLE',
      typeof body?.message === 'string' ? body.message : 'Account service is unavailable')
    return body.data as T
  }
  const post = <T>(path: string, body: unknown, csrf?: string) => request<T>(path, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-temuevent-client': 'web',
      ...(csrf ? { 'x-csrf-token': csrf } : {}) }, body: JSON.stringify(body),
  })

  async function refresh(): Promise<boolean> {
    if (refreshUncertain || !options.coordinate) return false
    if (refreshFlight) return refreshFlight
    refreshFlight = options.coordinate(async () => {
      if (refreshUncertain) return false
      // Another tab may have refreshed or logged in while this request waited for the lock.
      try { await request<UserView>('/api/me'); return true }
      catch (error) { if (!(error instanceof AuthApiError) || error.status !== 401) throw error }
      let csrf: { csrfToken: string }
      try { csrf = await request('/api/auth/csrf') }
      catch (error) {
        if (error instanceof AuthApiError && error.status === 401) return false
        throw error
      }
      try {
        await post<LoginSuccess['data']>('/api/auth/refresh', {}, csrf.csrfToken)
        return true
      } catch (error) {
        if (error instanceof AuthApiError && error.status === 401) return false
        // A lost response might follow a committed rotation. Never repeat it automatically.
        refreshUncertain = true
        options.onUncertain?.()
        throw new AuthApiError(0, 'SESSION_REFRESH_UNCERTAIN', 'Sign in again to reconnect the session')
      }
    }).finally(() => { refreshFlight = null })
    return refreshFlight
  }

  async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
    try { return await request<T>(path, { signal }) }
    catch (error) {
      if (!(error instanceof AuthApiError) || error.status !== 401 || signal?.aborted) throw error
      if (await refresh()) {
        try { return await request<T>(path, { signal }) }
        catch (retryError) {
          if (retryError instanceof AuthApiError && retryError.status === 401) options.onUnauthorized?.()
          throw retryError
        }
      }
      options.onUnauthorized?.()
      throw error
    }
  }
  return {
    get,
    me: (signal?: AbortSignal) => get<UserView>('/api/me', signal),
    register: (input: RegistrationRequest) => post<RegistrationSuccess['data']>('/api/auth/register', input),
    login: (input: LoginRequest) => coordinated(async () => {
      const result = await post<LoginSuccess['data']>('/api/auth/login', input)
      refreshUncertain = false
      return result.user
    }),
    logout: () => coordinated(async () => {
      let csrf: string | undefined
      try { csrf = (await request<{ csrfToken: string }>('/api/auth/csrf')).csrfToken }
      catch (error) { if (!(error instanceof AuthApiError) || error.status !== 401) throw error }
      await post('/api/auth/logout', {}, csrf)
      refreshUncertain = false
    }),
    disableRefresh: () => { refreshUncertain = true },
  }
}

export type AuthClient = ReturnType<typeof createAuthClient>

export function accountError(error: unknown): string {
  if (!(error instanceof AuthApiError)) return 'Terjadi kendala. Silakan coba lagi.'
  const messages: Record<string, string> = {
    EMAIL_IN_USE: 'Email ini sudah terdaftar. Silakan masuk.',
    INVALID_CREDENTIALS: 'Email atau kata sandi tidak sesuai.',
    INVALID_REGISTRATION: 'Periksa kembali data pendaftaran dan kode referral yang diisi.',
    INVALID_LOGIN: 'Masukkan email dan kata sandi yang valid.',
    INVALID_REFERRAL_CODE: 'Kode referral tidak ditemukan. Periksa kembali kodenya; akun belum dibuat.',
    REFERRAL_REGISTRATION_UNAVAILABLE: 'Pendaftaran dengan referral sedang terkendala. Coba lagi sebentar.',
    SESSION_REFRESH_UNCERTAIN: 'Silakan masuk ulang untuk menyambungkan sesi.',
    ROLE_FORBIDDEN: 'Halaman ini khusus untuk organizer.',
    SESSION_REQUIRED: 'Silakan masuk untuk melanjutkan.',
    NETWORK_UNAVAILABLE: 'Koneksi ke layanan akun belum tersedia. Coba lagi sebentar.',
  }
  if (error.status === 429) return 'Terlalu banyak percobaan. Tunggu beberapa saat sebelum mencoba lagi.'
  return messages[error.code] ?? 'Layanan akun sedang tidak tersedia. Silakan coba lagi.'
}

