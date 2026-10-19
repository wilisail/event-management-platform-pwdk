import { X509Certificate } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const source = 'https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt'
const expected = '80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA'
const target = new URL('./certs/prod-ca-2021.crt', import.meta.url)

try {
  const response = await fetch(source, { signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error(`Certificate download returned HTTP ${response.status}`)
  const pem = await response.text()
  if (new X509Certificate(pem).fingerprint256 !== expected) throw new Error('Certificate fingerprint did not match the verified Supabase CA')
  await mkdir(new URL('./certs/', import.meta.url), { recursive: true })
  await writeFile(target, pem)
  console.log(`Verified certificate saved: ${fileURLToPath(target)}`)
} catch (error) {
  console.error(`Certificate setup failed: ${error.message}`)
  process.exitCode = 1
}
