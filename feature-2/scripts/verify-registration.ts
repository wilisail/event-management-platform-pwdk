import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createApp } from '../server/app'
import { databaseClient, disconnectDatabase } from '../server/database'
import { createRegistrationService } from '../server/auth/registration'
import { prismaRegistrationRepository } from '../server/auth/registration-repository'
import { verifyPassword } from '../server/auth/passwords'

const db = databaseClient()
const rollback = new Error('ROLLBACK_REGISTRATION_CHECK')
const emails: string[] = []
let currentCheck = 'connection'

async function main() {
  await assert.rejects(db.$transaction(async tx => {
    const service = createRegistrationService({ repository: prismaRegistrationRepository(tx) })
    const server = createApp({ registrationService: service }).listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Missing port')
    const base = 'http://127.0.0.1:' + address.port
    const post = (input: unknown) => fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3001' },
      body: JSON.stringify(input),
    })
    try {
      const email = 'registration-check-' + randomUUID() + '@example.test'
      emails.push(email)
      const password = randomBytes(24).toString('base64url')
      currentCheck = 'real HTTP customer registration'
      const response = await post({ name: '  Registration Customer  ', email: email.toUpperCase(), password })
      const body = await response.json()
      assert.equal(response.status, 201)
      assert.equal(body.data.user.email, email)
      assert.equal(body.data.user.name, 'Registration Customer')
      assert.equal(body.data.user.role, 'CUSTOMER')
      assert.match(body.data.user.referralCode, /^[A-F0-9]{12}$/)
      assert.equal('passwordHash' in body.data.user, false)
      assert.equal(response.headers.get('set-cookie'), null)

      currentCheck = 'stored password hash'
      const stored = await tx.user.findUniqueOrThrow({ where: { email } })
      assert.equal(stored.id, body.data.user.id)
      assert(stored.passwordHash)
      assert.equal(stored.passwordHash === password, false)
      assert.equal(await verifyPassword(password, stored.passwordHash), true)
      assert.equal(await tx.authSession.count({ where: { userId: stored.id } }), 0)

      currentCheck = 'duplicate normalized email'
      const duplicate = await post({ name: 'Duplicate', email: ' ' + email.toUpperCase() + ' ', password })
      assert.equal(duplicate.status, 409)
      assert.equal((await duplicate.json()).code, 'EMAIL_IN_USE')
      assert.equal(await tx.user.count({ where: { email } }), 1)

      currentCheck = 'real organizer registration'
      const organizerEmail = 'registration-check-' + randomUUID() + '@example.test'
      emails.push(organizerEmail)
      const organizer = await post({ name: 'Registration Organizer', email: organizerEmail, password, role: 'ORGANIZER' })
      assert.equal(organizer.status, 201)
      assert.equal((await organizer.json()).data.user.role, 'ORGANIZER')

      currentCheck = 'invalid input/referral does not partially register'
      const refusedEmail = 'registration-check-' + randomUUID() + '@example.test'
      emails.push(refusedEmail)
      assert.equal((await post({ name: 'Invalid', email: refusedEmail, password: 'short' })).status, 400)
      const referral = await post({ name: 'Referral', email: refusedEmail, password, referralCode: 'AYU7K2P' })
      assert.equal(referral.status, 400)
      assert.equal((await referral.json()).code, 'REFERRAL_REGISTRATION_NOT_READY')
      assert.equal(await tx.user.count({ where: { email: refusedEmail } }), 0)
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
    throw rollback
  }, { timeout: 30000 }), error => error === rollback)
  currentCheck = 'rollback cleanup'
  assert.equal(await db.user.count({ where: { email: { in: emails } } }), 0)
  console.log(JSON.stringify({ passed: [
    'HTTP POST -> validation -> real password hashing -> Prisma -> Supabase PostgreSQL',
    'Customer/default and organizer accounts use database UUIDs and generated referral codes',
    'Stored password hash verifies the original secret; public response excludes it',
    'Normalized duplicate emails return 409; invalid/referral requests create no account',
    'Registration creates no session/cookie; all temporary test accounts roll back',
  ], scope: 'Registration backend; login/session issuance and frontend wiring remain separate batches' }, null, 2))
}

main().catch(() => {
  console.error('Registration verification failed at: ' + currentCheck)
  process.exitCode = 1
}).finally(disconnectDatabase)
