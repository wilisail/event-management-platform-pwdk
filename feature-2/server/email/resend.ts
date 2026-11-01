import { z } from 'zod'

export interface EmailMessage { to: string; subject: string; text: string; html: string; idempotencyKey: string }
export interface Mailer { send(message: EmailMessage): Promise<void> }
export class MailDeliveryError extends Error {
  constructor(readonly httpStatus?: number) { super('Email delivery unavailable') }
}

/** Backend only. RESET_API_KEY supports the existing privately saved Preview setting. */
export function resendMailer(env: Record<string, string | undefined> = process.env, transport: typeof fetch = fetch): Mailer | undefined {
  const key = env.RESEND_API_KEY || env.RESET_API_KEY
  if (!key) return undefined
  if (env.RESEND_API_KEY && env.RESET_API_KEY && env.RESEND_API_KEY !== env.RESET_API_KEY) throw new Error('Conflicting mail credentials')
  if (env.F2_EMAIL_PROVIDER && env.F2_EMAIL_PROVIDER !== 'resend') throw new Error('Unsupported mail provider')
  const from = env.F2_EMAIL_FROM
  if (!from || /[\r\n]/.test(from)) throw new Error('A configured sender is required')
  const address = from.includes('<') ? from.match(/^[^<>]+<([^<>]+)>$/)?.[1] : from
  if (!z.email().safeParse(address).success) throw new Error('Invalid configured sender')
  const only = env.F2_EMAIL_TEST_RECIPIENT?.trim().toLowerCase()
  if (only && !z.email().safeParse(only).success) throw new Error('Invalid test recipient')
  return {
    async send(message) {
      if (only && message.to.toLowerCase() !== only) throw new MailDeliveryError()
      let response: Response
      try {
        response = await transport('https://api.resend.com/emails', { method: 'POST', headers: {
          Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'Idempotency-Key': message.idempotencyKey,
        }, body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
        signal: AbortSignal.timeout(10000) })
      } catch { throw new MailDeliveryError() }
      // Provider error bodies may contain account information. Keep them out of application logs/responses.
      if (!response.ok) { await response.body?.cancel(); throw new MailDeliveryError(response.status) }
      const result = await response.json().catch(() => null)
      if (typeof result?.id !== 'string' || !result.id) throw new MailDeliveryError()
    },
  }
}
