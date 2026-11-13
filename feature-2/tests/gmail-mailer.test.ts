import assert from 'node:assert/strict'
import test from 'node:test'
import type { SendMailOptions } from 'nodemailer'
import { gmailMailer, type GmailTransportFactory } from '../server/email/gmail'
import { configuredMailer } from '../server/email/provider'
import { MailDeliveryError } from '../server/email/resend'
import { createDecisionEmailWorker, type DecisionEmailJob } from '../server/email/organizer-decision'
import { resetFixture } from './helpers/password-reset'
import { testAccount } from './helpers/sessions'

const config = {
  F2_EMAIL_PROVIDER: 'gmail', F2_GMAIL_USER: 'sender@gmail.com', F2_GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop',
  // Switching providers must not accidentally send as the old Resend test address.
  F2_EMAIL_FROM: 'TemuEvent <onboarding@resend.dev>', RESET_API_KEY: 'old-resend-key',
}
const message = { to: 'customer@example.test', subject: 'Recovery', text: 'private recovery link',
  html: '<p>private recovery link</p>', idempotencyKey: 'password-reset/job-1' }
const noNetwork: GmailTransportFactory = () => ({
  async verify() { return true }, async sendMail() { return { accepted: [message.to], rejected: [] } },
})

test('Gmail authorizes only its sender; an ordinary customer recipient need not match it', async () => {
  const sent: SendMailOptions[] = []
  const mailer = gmailMailer(config, options => {
    assert.equal(options.host, 'smtp.gmail.com'); assert.equal(options.port, 465); assert.equal(options.secure, true)
    assert.equal(options.tls?.rejectUnauthorized, true)
    assert.deepEqual(options.auth, { user: config.F2_GMAIL_USER, pass: 'abcdefghijklmnop' })
    assert.equal(options.logger, false); assert.equal(options.debug, false)
    assert.equal(options.disableFileAccess, true); assert.equal(options.disableUrlAccess, true)
    return { async verify() { return true }, async sendMail(input) { sent.push(input); return { accepted: [message.to] } } }
  })
  await mailer.verify(); await mailer.send(message); await mailer.send(message)
  assert.deepEqual(sent[0].from, { name: 'TemuEvent', address: config.F2_GMAIL_USER })
  assert.deepEqual(sent[0].envelope, { from: config.F2_GMAIL_USER, to: [message.to] })
  assert.equal(sent[0].text, message.text); assert.equal(sent[0].html, message.html)
  assert.equal(sent[0].messageId, sent[1].messageId)
  assert.equal(String(sent[0].messageId).includes(message.idempotencyKey), false)
  assert.equal(sent[0].disableFileAccess, true); assert.equal(sent[0].disableUrlAccess, true)
})

test('explicit Gmail configuration cannot fall back to Resend or use a different From identity', () => {
  assert.equal(configuredMailer({}), undefined)
  assert(configuredMailer(config))
  for (const invalid of [
    { ...config, F2_GMAIL_USER: undefined }, { ...config, F2_GMAIL_USER: 'someone@example.test' },
    { ...config, F2_GMAIL_USER: 'sender@gmail.com\r\nBcc: victim@example.test' },
    { ...config, F2_GMAIL_APP_PASSWORD: undefined }, { ...config, F2_GMAIL_APP_PASSWORD: 'not-an-app-password' },
    { ...config, F2_EMAIL_TEST_RECIPIENT: 'bad' },
  ]) assert.throws(() => gmailMailer(invalid, noNetwork))
  assert.throws(() => configuredMailer({ F2_EMAIL_PROVIDER: 'unknown' }), /Unsupported/)
})

test('SMTP verification and sending failures redact provider accounts, credentials and message bodies', async () => {
  const privateError = new Error('535 sender@gmail.com abcdefghijklmnop private recovery link')
  const mailer = gmailMailer(config, () => ({
    async verify() { throw privateError }, async sendMail() { throw privateError },
  }))
  for (const operation of [() => mailer.verify(), () => mailer.send(message)]) {
    await assert.rejects(operation(), error => {
      assert(error instanceof MailDeliveryError)
      assert.equal(error.message, 'Email delivery unavailable'); assert.equal(error.cause, undefined)
      return true
    })
  }
})

test('rejected or unacknowledged recipients are delivery failures, never successful queue acknowledgements', async () => {
  for (const result of [{ accepted: [] }, { accepted: ['other@example.test'] },
    { accepted: [message.to], rejected: [message.to] }]) {
    const mailer = gmailMailer(config, () => ({ async verify() { return true }, async sendMail() { return result } }))
    await assert.rejects(mailer.send(message), MailDeliveryError)
  }
})

test('test-recipient restrictions and invalid addressing stop before SMTP sending', async () => {
  let calls = 0
  const mailer = gmailMailer({ ...config, F2_EMAIL_TEST_RECIPIENT: message.to }, () => ({
    async verify() { return true }, async sendMail() { calls++; return { accepted: [message.to] } },
  }))
  await mailer.send(message)
  for (const input of [{ ...message, to: 'another@example.test' },
    { ...message, to: message.to + '\r\nBcc: other@example.test' }, { ...message, subject: 'Reset\r\nBcc: other@example.test' }]) {
    await assert.rejects(mailer.send(input), MailDeliveryError)
  }
  assert.equal(calls, 1)
})

test('password recovery retains the same capability and Message-ID across an SMTP retry', async () => {
  const f = resetFixture(), sent: SendMailOptions[] = []
  const mailer = gmailMailer(config, () => ({
    async verify() { return true }, async sendMail(input) {
      sent.push(input)
      if (sent.length === 1) throw new Error('temporary SMTP failure')
      return { accepted: [testAccount.email] }
    },
  }))
  const recovery = f.makeResetService({ mailer })
  await recovery.request({ email: testAccount.email }); await recovery.dispatchPending()
  assert.equal([...f.jobs.values()][0].deliveryState, 'RETRY')
  f.advance(5000); await recovery.dispatchPending()
  assert.equal([...f.jobs.values()][0].deliveryState, 'ACCEPTED')
  assert.equal(sent[0].messageId, sent[1].messageId); assert.equal(sent[0].text, sent[1].text)
  assert.match(String(sent[1].text), /reset-password#token=/)
})

test('organizer notifications reuse the same Gmail adapter and acknowledge only after SMTP acceptance', async () => {
  const job: DecisionEmailJob = { id: 'decision-1', recipientEmail: message.to, subject: 'Decision',
    textBody: 'Accepted', htmlBody: '<p>Accepted</p>', leaseId: 'lease-1', attemptCount: 1 }
  const sent: SendMailOptions[] = [], outcomes: string[] = []
  let claimed = false
  const mailer = gmailMailer(config, () => ({
    async verify() { return true }, async sendMail(input) { sent.push(input); return { accepted: [message.to] } },
  }))
  const worker = createDecisionEmailWorker({
    async claim() { if (claimed) return null; claimed = true; return job },
    async finish(_, outcome) { outcomes.push(outcome) }, async closeExpiredAttempts() {},
  }, mailer)
  await worker.dispatchPending(); await worker.dispatchPending()
  assert.equal(sent.length, 1); assert.equal(sent[0].subject, job.subject)
  assert.deepEqual(outcomes, ['ACCEPTED'])
})
