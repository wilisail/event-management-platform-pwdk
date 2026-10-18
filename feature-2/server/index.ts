import { createApp } from './app'

const port = Number(process.env.F2_API_PORT || 4002)
const host = process.env.F2_API_HOST || '127.0.0.1'
const allowedOrigins = (
  process.env.F2_ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001'
)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid F2_API_PORT')

createApp({ allowedOrigins }).listen(port, host, () => {
  console.log(`F2 read-only DEMO API: http://${host}:${port}`)
  console.log('x-demo-persona is a demo selector, NOT authentication. No database writes occur.')
})
