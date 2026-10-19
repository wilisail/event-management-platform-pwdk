/** @type {import('next').NextConfig} */
const config = {
  async rewrites() {
    const apiOrigin = process.env.F2_DEMO_API_ORIGIN || 'http://127.0.0.1:4002'
    return [{ source: '/api/demo/:path*', destination: `${apiOrigin}/api/demo/:path*` }]
  },
}
export default config
