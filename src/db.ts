import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { env } from './config'
import { hashPassword } from './security/password'

const dbPath = join(process.cwd(), 'data', 'mail-demo.sqlite')
mkdirSync(dirname(dbPath), { recursive: true })

export const db = new Database(dbPath)

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS gmail_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    google_sub TEXT NOT NULL,
    google_email TEXT NOT NULL,
    refresh_token_encrypted TEXT NOT NULL,
    scope TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`)

const existingUser = db
  .query('SELECT id FROM users WHERE email = ?')
  .get(env.DEMO_USER_EMAIL) as { id: number } | null

if (!existingUser) {
  db.query('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(
    env.DEMO_USER_EMAIL,
    hashPassword(env.DEMO_USER_PASSWORD),
  )
}

export type UserRow = {
  id: number
  email: string
  password_hash: string
}

export type GmailAccountRow = {
  id: number
  user_id: number
  google_sub: string
  google_email: string
  refresh_token_encrypted: string
  scope: string
}

db.exec(`
  CREATE TABLE IF NOT EXISTS thread_classifications (
    thread_id TEXT PRIMARY KEY,
    important INTEGER NOT NULL,
    reason TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    message_count INTEGER NOT NULL,
    classified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`)

// Thêm cột summary nếu chưa có (migrate)
try {
  db.exec(`ALTER TABLE thread_classifications ADD COLUMN summary TEXT NOT NULL DEFAULT ''`)
} catch {}

export type ThreadClassificationRow = {
  thread_id: string
  important: number
  reason: string
  summary: string
  message_count: number
}
