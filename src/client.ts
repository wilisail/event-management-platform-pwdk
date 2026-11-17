import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'
let instance: PrismaClient | undefined
export function databaseClient() {
  if (instance) return instance
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('Set DATABASE_URL in the ignored database/.env file')
  const adapter = new PrismaPg({ connectionString, max: 3, connectionTimeoutMillis: 8000 })
  instance = new PrismaClient({ adapter })
  return instance
}
export async function disconnectDatabase() {
  await instance?.$disconnect()
  instance = undefined
}
