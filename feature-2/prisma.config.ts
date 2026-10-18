import 'dotenv/config'
import { defineConfig } from 'prisma/config'

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node --import tsx prisma/seed.ts',
  },
  // Client generation works without a hosted database or credentials.
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
})
