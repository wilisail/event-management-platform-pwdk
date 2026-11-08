/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: { '/api/*': ['./database/certs/prod-ca-2021.crt'] },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    if (process.env.VERCEL === '1' || process.env.TEMUEVENT_HOSTED_API === 'true') return []
    const origin = process.env.TEMUEVENT_API_ORIGIN || 'http://127.0.0.1:4002'
    const url = new URL(origin)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Use an API origin without credentials or a path')
    return [{ source: '/api/:path*', destination: `${url.origin}/api/:path*` }]
  },
}

export default nextConfig
