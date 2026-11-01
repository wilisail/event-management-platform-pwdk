'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { LoginRequest, UserView } from '../contracts/types'
import { accountError, AuthApiError, createAuthClient, type AuthClient } from '../lib/auth-client'

type SessionState = { status: 'loading' | 'authenticated' | 'anonymous' | 'error'; user: UserView | null; error: string }
interface AuthContextValue extends SessionState {
  notice: string
  client: AuthClient
  reload: () => Promise<void>
  signIn: (input: LoginRequest) => Promise<UserView>
  signOut: () => Promise<void>
  saveName: (name: string) => Promise<UserView>
  uploadPicture: (file: File) => Promise<UserView>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
}
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading', user: null, error: '' })
  const [notice, setNotice] = useState('')
  const channel = useRef<BroadcastChannel | null>(null)
  const version = useRef(0)
  const [client] = useState(() => createAuthClient({
    coordinate: typeof navigator !== 'undefined' && navigator.locks
      ? async work => await navigator.locks.request('temuevent-auth', work) : undefined,
    onUnauthorized: () => setState({ status: 'anonymous', user: null, error: '' }),
    onUncertain: () => channel.current?.postMessage({ type: 'uncertain' }),
  }))
  const reload = useCallback(async (signal?: AbortSignal) => {
    const current = ++version.current
    try {
      const user = await client.me(signal)
      if (current === version.current && !signal?.aborted) setState({ status: 'authenticated', user, error: '' })
    } catch (error) {
      if (current !== version.current || signal?.aborted) return
      setState(error instanceof AuthApiError && error.status === 401
        ? { status: 'anonymous', user: null, error: '' }
        : { status: 'error', user: null, error: accountError(error) })
    }
  }, [client])
  useEffect(() => {
    const abort = new AbortController()
    void reload(abort.signal)
    if (typeof BroadcastChannel !== 'undefined') {
      const bus = new BroadcastChannel('temuevent-session')
      channel.current = bus
      bus.onmessage = event => {
        if (event.data?.type === 'password-changed' || event.data?.type === 'password-uncertain') {
          version.current++
          client.disableRefresh()
          setNotice(event.data.type === 'password-changed'
            ? 'Kata sandi berubah. Semua sesi telah keluar. Silakan masuk kembali.'
            : accountError(new AuthApiError(0, 'PASSWORD_CHANGE_UNCERTAIN', '')))
          setState({ status: 'anonymous', user: null, error: '' })
        }
        if (event.data?.type === 'changed') void reload()
        if (event.data?.type === 'uncertain') {
          client.disableRefresh()
          setState({ status: 'error', user: null, error: 'Silakan masuk ulang untuk menyambungkan sesi.' })
        }
      }
    }
    return () => { abort.abort(); channel.current?.close(); channel.current = null }
  }, [client, reload])
  const signIn = async (input: LoginRequest) => {
    const user = await client.login(input)
    setNotice('')
    version.current++
    setState({ status: 'authenticated', user, error: '' })
    channel.current?.postMessage({ type: 'changed' })
    return user
  }
  const signOut = async () => {
    await client.logout()
    version.current++
    setState({ status: 'anonymous', user: null, error: '' })
    channel.current?.postMessage({ type: 'changed' })
  }
  const profileChanged = (user: UserView) => {
    version.current++
    setState(current => current.status === 'authenticated' && current.user?.id === user.id
      ? { status: 'authenticated', user, error: '' } : current)
    channel.current?.postMessage({ type: 'changed' })
    return user
  }
  const saveName = async (name: string) => profileChanged(await client.updateProfile(name))
  const uploadPicture = async (file: File) => profileChanged(await client.uploadPicture(file))
  const passwordSignedOut = (uncertain: boolean) => {
    version.current++
    client.disableRefresh()
    setNotice(uncertain ? accountError(new AuthApiError(0, 'PASSWORD_CHANGE_UNCERTAIN', ''))
      : 'Kata sandi berhasil diubah. Semua sesi telah keluar. Masuk kembali dengan kata sandi baru.')
    setState({ status: 'anonymous', user: null, error: '' })
    channel.current?.postMessage({ type: uncertain ? 'password-uncertain' : 'password-changed' })
  }
  const changePassword = async (currentPassword: string, newPassword: string) => {
    try { await client.changePassword(currentPassword, newPassword); passwordSignedOut(false) }
    catch (error) {
      if (error instanceof AuthApiError && error.code === 'PASSWORD_CHANGE_UNCERTAIN') passwordSignedOut(true)
      throw error
    }
  }
  return <AuthContext.Provider value={{ ...state, notice, client, reload, signIn, signOut, saveName, uploadPicture, changePassword }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('AuthProvider is required')
  return auth
}
