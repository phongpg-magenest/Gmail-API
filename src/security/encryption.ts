import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { env } from '../config'

const KEY = createHash('sha256')
  .update(env.TOKEN_ENCRYPTION_SECRET)
  .digest()

export function encryptText(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', KEY, iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [iv, tag, ciphertext].map(part => part.toString('base64url')).join('.')
}

export function decryptText(payload: string): string {
  const [ivEncoded, tagEncoded, ciphertextEncoded] = payload.split('.')
  if (!ivEncoded || !tagEncoded || !ciphertextEncoded) {
    throw new Error('Invalid encrypted token payload')
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    KEY,
    Buffer.from(ivEncoded, 'base64url'),
  )
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, 'base64url')),
    decipher.final(),
  ])
  return plaintext.toString('utf8')
}
