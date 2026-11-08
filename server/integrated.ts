import 'dotenv/config'
import { createIntegratedRuntime } from './integration-runtime'

// One process and one F2 session authority. Never load the private developer .env.rizky here.
const port = Number(process.env.F2_API_PORT || 4002)
const host = process.env.F2_API_HOST || '127.0.0.1'
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid API port')

async function start() {
  const runtime = await createIntegratedRuntime()
  const server = runtime.app.listen(port, host, () => console.log('TemuEvent combined API ready'))
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {
    server.close(() => {
      void runtime.disconnect().finally(() => process.exit(0))
    })
  })
}

start().catch(() => { console.error('Combined API could not start; check backend configuration.'); process.exitCode = 1 })
