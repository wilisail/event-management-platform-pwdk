import 'dotenv/config'
import { config } from 'dotenv'
import { resolve } from 'node:path'
import { defineConfig } from 'prisma/config'

config({ path: '.env.rizky', override: true, quiet: true })
const developmentUrl = process.env.F1_DEV_DATABASE_URL
const databaseUrl = developmentUrl || process.env.DIRECT_URL || process.env.DATABASE_URL
const shadowUrl = developmentUrl ? process.env.F1_SHADOW_DATABASE_URL : undefined
if (developmentUrl && !shadowUrl) {
  throw new Error('F1_SHADOW_DATABASE_URL is required with F1_DEV_DATABASE_URL')
}

function migrationUrl(value: string) {
  const url = new URL(value)
  if (process.env.DATABASE_CA_CERT_PATH) {
    url.searchParams.set('sslmode', 'require')
    url.searchParams.set('sslaccept', 'strict')
    url.searchParams.set('sslcert', resolve(process.env.DATABASE_CA_CERT_PATH))
  }
  return url.toString()
}

if (developmentUrl && shadowUrl) {
  const development = new URL(developmentUrl)
  const shadow = new URL(shadowUrl)
  if (development.host === shadow.host && development.pathname === shadow.pathname) {
    throw new Error('Development and shadow databases must have different database names')
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: developmentUrl ? 'prisma/rizky-migrations' : 'prisma/migrations',
    seed: 'node --import ./server/rizky-env.mjs --import tsx prisma/seed.ts',
  },
  ...(databaseUrl ? {
    datasource: {
      url: migrationUrl(databaseUrl),
      ...(shadowUrl ? { shadowDatabaseUrl: migrationUrl(shadowUrl) } : {}),
    },
  } : {}),
})
