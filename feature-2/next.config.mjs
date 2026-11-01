/** @type {import('next').NextConfig} */
const config = {
  async headers() {
    return ['/forgot-password', '/reset-password'].map(source => ({ source, headers: [
      { key: 'Referrer-Policy', value: 'no-referrer' }, { key: 'Cache-Control', value: 'no-store' },
    ] }))
  },
  async rewrites() {
    const apiOrigin = process.env.F2_API_ORIGIN || process.env.F2_DEMO_API_ORIGIN || 'http://127.0.0.1:4002'
    return [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }]
  },
}
export default config
