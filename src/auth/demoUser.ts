import { db, type UserRow } from '../db'
import { verifyPassword } from '../security/password'

export function findUserByEmail(email: string): UserRow | null {
  return (
    (db
      .query('SELECT id, email, password_hash FROM users WHERE email = ?')
      .get(email) as UserRow | null) ?? null
  )
}

export function findUserById(id: number): UserRow | null {
  return (
    (db
      .query('SELECT id, email, password_hash FROM users WHERE id = ?')
      .get(id) as UserRow | null) ?? null
  )
}

export function authenticateDemoUser(
  email: string,
  password: string,
): UserRow | null {
  const user = findUserByEmail(email)
  if (!user) {
    return null
  }

  return verifyPassword(password, user.password_hash) ? user : null
}
