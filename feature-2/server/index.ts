import 'dotenv/config'
import { createRuntime } from './runtime'

const port = Number(process.env.F2_API_PORT || 4002), host = process.env.F2_API_HOST || '127.0.0.1'
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid F2_API_PORT')
async function start() {
  const runtime = await createRuntime()
  const enableDecisionEmail = process.env.F2_DECISION_EMAIL_WORKER_ENABLED === 'true'
  const decisionEmailWorker = enableDecisionEmail ? runtime.decisionEmailWorker : undefined
  if (enableDecisionEmail && !decisionEmailWorker) throw new Error('Decision email requires database and mail configuration')
  const server = runtime.app.listen(port, host, () => console.log('Feature 2 API: http://' + host + ':' + port))
  // Long-lived Node executor. Cloud adapters must explicitly retain work and schedule retries.
  const dispatchPending = () => {
    void runtime.passwordResetService?.dispatchPending()
    void decisionEmailWorker?.dispatchPending()
  }
  const timer = setInterval(dispatchPending, 5000)
  timer.unref()
  dispatchPending()
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {
    clearInterval(timer)
    server.close(() => { void Promise.resolve(runtime.disconnect?.()).finally(() => process.exit(0)) })
  })
}
start().catch(() => { console.error('Unable to start the API. Check the backend configuration.'); process.exitCode = 1 })
