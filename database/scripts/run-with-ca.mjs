import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
if (existsSync('.env')) process.loadEnvFile('.env')
const certificate = resolve('certs/prod-ca-2021.crt')
if (!existsSync(certificate)) throw new Error('The Supabase CA certificate is missing')
const target = process.argv[2]
if (!['scripts/check.ts', 'scripts/verify.ts', 'scripts/verify-auth.ts'].includes(target)) throw new Error('Unknown database command')
const result = spawnSync(process.execPath, ['--import', 'tsx', target], {
  env: { ...process.env, NODE_EXTRA_CA_CERTS: certificate }, stdio: 'inherit',
})
if (result.error) throw result.error
process.exitCode = result.status ?? 1

