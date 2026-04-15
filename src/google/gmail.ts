import { google, gmail_v1 } from 'googleapis'
import { db, type GmailAccountRow } from '../db'
import { decryptText, encryptText } from '../security/encryption'
import { createOAuthClient } from './oauth'

type StoredGoogleIdentity = {
  email: string
  sub: string
}

export function getGmailAccountForUser(userId: number): GmailAccountRow | null {
  return (
    (db
      .query(
        `SELECT id, user_id, google_sub, google_email, refresh_token_encrypted, scope
         FROM gmail_accounts
         WHERE user_id = ?`,
      )
      .get(userId) as GmailAccountRow | null) ?? null
  )
}

export function upsertGmailAccount(
  userId: number,
  identity: StoredGoogleIdentity,
  refreshToken: string,
  scope: string,
) {
  const encryptedToken = encryptText(refreshToken)

  db.query(
    `INSERT INTO gmail_accounts (
      user_id, google_sub, google_email, refresh_token_encrypted, scope
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      google_sub = excluded.google_sub,
      google_email = excluded.google_email,
      refresh_token_encrypted = excluded.refresh_token_encrypted,
      scope = excluded.scope,
      updated_at = CURRENT_TIMESTAMP`,
  ).run(userId, identity.sub, identity.email, encryptedToken, scope)
}

export function disconnectGmailAccount(userId: number) {
  db.query('DELETE FROM gmail_accounts WHERE user_id = ?').run(userId)
}

function createAuthorizedGmailClient(account: GmailAccountRow) {
  const client = createOAuthClient()
  client.setCredentials({
    refresh_token: decryptText(account.refresh_token_encrypted),
  })
  return google.gmail({ version: 'v1', auth: client })
}

function normalizeHeaders(payload?: gmail_v1.Schema$MessagePart): Record<string, string> {
  const headers = payload?.headers ?? []
  const values: Record<string, string> = {}
  for (const header of headers) {
    if (!header.name || !header.value) {
      continue
    }
    const lowerName = header.name.toLowerCase()
    if (['subject', 'from', 'to', 'date'].includes(lowerName)) {
      values[lowerName] = header.value
    }
  }
  return values
}

export type ThreadSummary = {
  id: string           // threadId
  subject: string
  messageCount: number
  // Tin đầu tiên (người khởi tạo)
  firstFrom: string
  firstDate: string
  // Tin cuối cùng (trạng thái hiện tại)
  lastFrom: string
  lastDate: string
  lastSnippet: string
  lastLabelIds: string[]
  // Toàn bộ snippets để LLM đánh giá context
  allSnippets: string[]
}

export async function listThreadsForUser(args: {
  userId: number
  q?: string
  labelIds?: string[]
  maxResults?: number
}) {
  const account = getGmailAccountForUser(args.userId)
  if (!account) {
    throw new Error('No Gmail account connected for this user.')
  }

  const gmail = createAuthorizedGmailClient(account)
  const { data } = await gmail.users.threads.list({
    userId: 'me',
    q: args.q,
    labelIds: args.labelIds,
    maxResults: args.maxResults ?? 20,
  })

  const threadIds = (data.threads ?? []).map(t => t.id ?? '')

  const threads = await Promise.all(
    threadIds.map(id =>
      gmail.users.threads.get({
        userId: 'me',
        id,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date'],
      }).then(r => {
        const messages = r.data.messages ?? []
        const first = messages[0]
        const last = messages[messages.length - 1]

        const firstHeaders = normalizeHeaders(first?.payload)
        const lastHeaders = normalizeHeaders(last?.payload)

        return {
          id: r.data.id ?? '',
          subject: firstHeaders.subject ?? '(no subject)',
          messageCount: messages.length,
          firstFrom: firstHeaders.from ?? '',
          firstDate: firstHeaders.date ?? '',
          lastFrom: lastHeaders.from ?? '',
          lastDate: lastHeaders.date ?? '',
          lastSnippet: last?.snippet ?? '',
          lastLabelIds: last?.labelIds ?? [],
          allSnippets: messages.map(m => m.snippet ?? '').filter(Boolean),
        } satisfies ThreadSummary
      })
    )
  )

  return {
    connectedAccount: account.google_email,
    query: args.q ?? '',
    threads,
  }
}

export async function getThreadForUser(args: {
  userId: number
  threadId: string
}) {
  const account = getGmailAccountForUser(args.userId)
  if (!account) {
    throw new Error('No Gmail account connected for this user.')
  }

  const gmail = createAuthorizedGmailClient(account)
  const { data } = await gmail.users.threads.get({
    userId: 'me',
    id: args.threadId,
    format: 'metadata',
    metadataHeaders: ['From', 'To', 'Subject', 'Date'],
  })

  const messages = (data.messages ?? []).map(m => ({
    id: m.id ?? '',
    snippet: m.snippet ?? '',
    headers: normalizeHeaders(m.payload),
    labelIds: m.labelIds ?? [],
  }))

  const firstHeaders = messages[0]?.headers ?? {}

  return {
    connectedAccount: account.google_email,
    threadId: data.id ?? '',
    subject: firstHeaders.subject ?? '(no subject)',
    messageCount: messages.length,
    messages,
  }
}
