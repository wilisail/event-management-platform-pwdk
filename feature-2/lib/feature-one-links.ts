export function featureOneOrigin(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if ((url.protocol !== 'https:' && !localHttp) || url.username || url.password || url.search || url.hash || url.pathname !== '/') return null
    return url.origin
  } catch { return null }
}

export function featureOneUrl(path: string): string | null {
  const origin = featureOneOrigin(process.env.NEXT_PUBLIC_F1_ORIGIN ??
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : undefined))
  return origin && path.startsWith('/') && !path.startsWith('//') && !path.includes('\\') ? origin + path : null
}
