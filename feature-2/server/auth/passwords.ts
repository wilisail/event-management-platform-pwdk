import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

export const newPasswordSchema = z.string()
  .refine(value => [...value].length >= 15, 'Use at least 15 characters')
  .refine(value => [...value].length <= 128, 'Use at most 128 characters')
  .refine(value => value.trim().length > 0, 'A password cannot contain only spaces')

// OWASP's 32 MiB scrypt profile. Keep encoded parameters with each stored hash.
const parameters = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }
const prefix = 'scrypt-v1$32768$8$3'
let activeJobs = 0

export class PasswordWorkLimitError extends Error {
  constructor() {
    super('Password processing is busy')
    this.name = 'PasswordWorkLimitError'
  }
}

async function derive(password: string, salt: Buffer): Promise<Buffer> {
  if (activeJobs >= 2) throw new PasswordWorkLimitError()
  activeJobs++
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      scrypt(password, salt, 64, parameters, (error, key) => {
        if (error) reject(error)
        else resolve(key)
      })
    })
  } finally {
    activeJobs--
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(password, salt)
  return [prefix, salt.toString('hex'), key.toString('hex')].join('$')
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split('$')
  // Whitelist supported costs rather than allocating memory from arbitrary stored parameters.
  if (parts.length !== 6 || parts.slice(0, 4).join('$') !== prefix) return false
  if (!/^[a-f0-9]{32}$/.test(parts[4]) || !/^[a-f0-9]{128}$/.test(parts[5])) return false
  const key = await derive(password, Buffer.from(parts[4], 'hex'))
  return timingSafeEqual(key, Buffer.from(parts[5], 'hex'))
}
