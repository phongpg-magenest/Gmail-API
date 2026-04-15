import { google } from 'googleapis'
import { env, GMAIL_READONLY_SCOPE } from '../config'

export function createOAuthClient() {
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  )
}

export function buildGoogleAuthUrl(state: string) {
  return createOAuthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [GMAIL_READONLY_SCOPE],
    state,
  })
}

export async function exchangeCodeForTokens(code: string) {
  const client = createOAuthClient()
  const { tokens } = await client.getToken(code)
  client.setCredentials(tokens)
  const gmail = google.gmail({ version: 'v1', auth: client })
  const { data } = await gmail.users.getProfile({ userId: 'me' })

  return {
    tokens,
    profile: data,
  }
}
