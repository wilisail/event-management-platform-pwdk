import { gmailMailer } from './gmail'
import { resendMailer, type Mailer } from './resend'

/** One server-side provider for account recovery and organizer decision notifications. */
export function configuredMailer(env: Record<string, string | undefined> = process.env): Mailer | undefined {
  switch (env.F2_EMAIL_PROVIDER || 'resend') {
    case 'resend': return resendMailer(env)
    case 'gmail': return gmailMailer(env)
    default: throw new Error('Unsupported mail provider')
  }
}
