import { createHash } from 'node:crypto'
import { createTransport, type SendMailOptions } from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import { z } from 'zod'
import { MailDeliveryError, type Mailer } from './resend'

export interface GmailTransport {
  sendMail(message: SendMailOptions): Promise<{ accepted: unknown[]; rejected?: unknown[] }>
  verify(): Promise<unknown>
}
export type GmailTransportFactory = (options: SMTPTransport.Options) => GmailTransport
export interface GmailMailer extends Mailer { verify(): Promise<void> }

/** Backend only. Gmail sends as the authorized account, independently of the Resend From setting. */
export function gmailMailer(env: Record<string, string | undefined> = process.env,
  connect: GmailTransportFactory = options => createTransport(options)): GmailMailer {
  const user = env.F2_GMAIL_USER?.trim().toLowerCase()
  const password = env.F2_GMAIL_APP_PASSWORD?.replace(/\s/g, '')
  if (!user || !z.email().safeParse(user).success || !/@(?:gmail|googlemail)\.com$/.test(user)) {
    throw new Error('A Gmail sender account is required')
  }
  if (!password || !/^[A-Za-z0-9]{16}$/.test(password)) throw new Error('A Gmail app password is required')
  const only = env.F2_EMAIL_TEST_RECIPIENT?.trim().toLowerCase()
  if (only && !z.email().safeParse(only).success) throw new Error('Invalid test recipient')
  const smtp = connect({
    host: 'smtp.gmail.com', port: 465, secure: true, pool: false,
    auth: { user, pass: password },
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    dnsTimeout: 5000, connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000,
    logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true,
  })
  return {
    async verify() {
      try { await smtp.verify() } catch { throw new MailDeliveryError() }
    },
    async send(message) {
      if (!z.email().safeParse(message.to).success || /[\r\n]/.test(message.subject) ||
        (only && message.to.toLowerCase() !== only)) throw new MailDeliveryError()
      try {
        const result = await smtp.sendMail({
          from: { name: 'TemuEvent', address: user }, to: message.to,
          envelope: { from: user, to: [message.to] },
          subject: message.subject, text: message.text, html: message.html,
          // Stable across retries; SMTP Message-ID is not a provider deduplication guarantee.
          messageId: '<temuevent-' + createHash('sha256').update(message.idempotencyKey).digest('hex') + '@gmail.com>',
          disableFileAccess: true, disableUrlAccess: true,
        })
        if (result.rejected?.length || !result.accepted.some(address =>
          typeof address === 'string' && address.toLowerCase() === message.to.toLowerCase())) {
          throw new MailDeliveryError()
        }
      } catch { // SMTP errors can contain account addresses, credentials and message contents.
        throw new MailDeliveryError()
      }
    },
  }
}
