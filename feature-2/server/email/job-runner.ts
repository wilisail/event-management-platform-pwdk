import { timingSafeEqual } from 'node:crypto'
import type { RequestHandler } from 'express'

type Dispatch = () => Promise<boolean>
export interface ScheduledEmailJobs {
  secret: string
  passwordReset?: Dispatch
  // null is intentional opt-out. Undefined means enabled but unavailable.
  decisionEmails: Dispatch | null | undefined
  purchaseDeadlines?: Dispatch
}

export function scheduledEmailHandler(jobs: ScheduledEmailJobs | undefined): RequestHandler {
  const secret = jobs && /^[a-f0-9]{64}$/.test(jobs.secret) ? Buffer.from(jobs.secret, 'hex') : null
  return async (req, res) => {
    res.set('Cache-Control', 'no-store')
    if (!jobs || !secret) { res.status(404).json({ success: false, code: 'JOB_RUNNER_DISABLED' }); return }
    const supplied = /^Bearer ([a-f0-9]{64})$/.exec(req.get('authorization') ?? '')?.[1]
    if (!supplied || !timingSafeEqual(Buffer.from(supplied, 'hex'), secret)) {
      res.status(401).json({ success: false, code: 'JOB_RUNNER_UNAUTHORIZED' }); return
    }
    if (Object.keys(req.query).length) { res.status(400).json({ success: false, code: 'JOB_RUNNER_INVALID_REQUEST' }); return }
    if (!jobs.passwordReset || jobs.decisionEmails === undefined) {
      console.warn({ event: 'email_job_runner_unavailable' })
      res.status(503).json({ success: false, code: 'JOB_RUNNER_UNAVAILABLE' }); return
    }
    const started = Date.now()
    const purchaseDeadlines = jobs.purchaseDeadlines ? await jobs.purchaseDeadlines().catch(() => false) : undefined
    const [passwordReset, decisionEmails] = await Promise.all([
      jobs.passwordReset().catch(() => false),
      jobs.decisionEmails ? jobs.decisionEmails().catch(() => false) : null,
    ])
    const success = passwordReset && decisionEmails !== false && purchaseDeadlines !== false
    const result = { passwordReset, decisionEmails,
      ...(purchaseDeadlines === undefined ? {} : { purchaseDeadlines }), durationMs: Date.now() - started }
    if (success) console.info({ event: 'email_job_runner_complete', ...result })
    else console.warn({ event: 'email_job_runner_failed', ...result })
    res.status(success ? 200 : 503).json({ success, ...result })
  }
}
