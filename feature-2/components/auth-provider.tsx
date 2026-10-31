'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { LoginRequest, UserView } from '../contracts/types'
import { accountError, AuthApiError, createAuthClient, type AuthClient } from '../lib/auth-client'

type SessionState = { status: 'loading' | 'authenticated' | 'anonymous' | 'error'; user: UserView | null; error: string }
interface AuthContextValue extends SessionState {
  client: AuthClient
  reload: () => Promise<void>
  signIn: (input: LoginRequest) => Promise<UserView>
  signOut: () => Promise<void>
}
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading', user: null, error: '' })
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
  return <AuthContext.Provider value={{ ...state, client, reload, signIn, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('AuthProvider is required')
  return auth
}
