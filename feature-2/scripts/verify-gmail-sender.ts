import 'dotenv/config'
import { gmailMailer } from '../server/email/gmail'

// Authenticates only. It neither sends an email nor reads/modifies customer records.
async function main() {
  if (process.env.F2_EMAIL_PROVIDER !== 'gmail') throw new Error('Select the Gmail mail provider first')
  await gmailMailer().verify()
  console.log('GMAIL_SMTP_AUTH_OK — no email sent; real inbox recovery acceptance remains pending.')
}
main().catch(() => {
  console.error('GMAIL_SMTP_AUTH_FAILED — check the private sender settings and Google authorization.')
  process.exitCode = 1
})
