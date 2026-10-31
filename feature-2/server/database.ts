import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { rootCertificates } from 'node:tls'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

export const seededUserEmail = 'ayu@example.test'

export interface DatabaseUserView {
  id: string
  email: string
  name: string
  role: 'CUSTOMER' | 'ORGANIZER'
  referralCode: string
}

let client: PrismaClient | undefined

export function databaseClient() {
  if (client) return client
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is required for database commands')
  const certificatePath = process.env.DATABASE_CA_CERT_PATH ||
    resolve(__dirname, '../../database/certs/prod-ca-2021.crt')
  const connection = new URL(connectionString)
  if (!['postgres:', 'postgresql:'].includes(connection.protocol)) {
    throw new Error('A PostgreSQL database connection is required')
  }
  // pg URI SSL options override an explicit ssl object. Use the verified settings below.
  for (const key of ['ssl', 'sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat']) {
    connection.searchParams.delete(key)
  }
  const adapter = new PrismaPg({
    connectionString: connection.toString(),
    max: 3,
    connectionTimeoutMillis: 8000,
    ssl: {
      ca: [...rootCertificates, readFileSync(certificatePath, 'utf8')],
      rejectUnauthorized: true,
    },
  })
  client = new PrismaClient({ adapter })
  return client
}

export function readSeededDatabaseUser(): Promise<DatabaseUserView | null> {
  return databaseClient().user.findUnique({
    where: { email: seededUserEmail },
    select: { id: true, email: true, name: true, role: true, referralCode: true },
  })
}

export async function disconnectDatabase() {
  await client?.$disconnect()
  client = undefined
}

