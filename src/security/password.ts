import { createHash, timingSafeEqual } from 'node:crypto'

export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  const candidate = Buffer.from(hashPassword(password))
  const existing = Buffer.from(passwordHash)
  return (
    candidate.length === existing.length && timingSafeEqual(candidate, existing)
  )
}
