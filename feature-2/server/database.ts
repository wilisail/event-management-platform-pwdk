import 'dotenv/config'
import { readFileSync } from 'node:fs'
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
  const certificatePath = process.env.DATABASE_CA_CERT_PATH
  const adapter = new PrismaPg({
    connectionString,
    max: 3,
    connectionTimeoutMillis: 8000,
    ...(certificatePath
      ? { ssl: { ca: readFileSync(certificatePath, 'utf8'), rejectUnauthorized: true } }
      : {}),
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
