import 'dotenv/config'
import { createRuntime } from './runtime'

const port = Number(process.env.F2_API_PORT || 4002), host = process.env.F2_API_HOST || '127.0.0.1'
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid F2_API_PORT')
async function start() {
  const runtime = await createRuntime()
  const server = runtime.app.listen(port, host, () => console.log('Feature 2 API: http://' + host + ':' + port))
  // Long-lived Node executor. Cloud adapters must explicitly retain work and schedule retries.
  const timer = setInterval(() => { void runtime.passwordResetService?.dispatchPending() }, 5000)
  timer.unref()
  void runtime.passwordResetService?.dispatchPending()
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {
    clearInterval(timer)
    server.close(() => { void Promise.resolve(runtime.disconnect?.()).finally(() => process.exit(0)) })
  })
}
start().catch(() => { console.error('Unable to start the API. Check the backend configuration.'); process.exitCode = 1 })
