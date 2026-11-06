import { config } from 'dotenv'
import { resolve } from 'node:path'
import { defineConfig, env } from 'prisma/config'

config({ path: '.env.rizky' })
const url = new URL(env('F1_SHARED_MIGRATION_URL'))
if (process.env.DATABASE_CA_CERT_PATH) {
  url.searchParams.set('sslmode', 'require')
  url.searchParams.set('sslaccept', 'strict')
  url.searchParams.set('sslcert', resolve(process.env.DATABASE_CA_CERT_PATH))
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url: url.toString() },
})
