import { Router } from 'express'
import { requireSession } from '../auth/session'
import { upsertGmailAccount } from '../google/gmail'
import { getGmailAccountForUser } from '../google/gmail'
import { buildGoogleAuthUrl, exchangeCodeForTokens } from '../google/oauth'
import { renderDashboardPage } from '../views/pages'

const router = Router()

router.get('/auth/google/start', requireSession, (req, res) => {
  const state = Buffer.from(
    JSON.stringify({
      userId: req.sessionUser!.id,
      nonce: crypto.randomUUID(),
    }),
  ).toString('base64url')

  res.redirect(buildGoogleAuthUrl(state))
})

router.get('/auth/google/callback', async (req, res) => {
  const code = typeof req.query.code === 'string' ? req.query.code : ''
  const state = typeof req.query.state === 'string' ? req.query.state : ''

  if (!code || !state) {
    res.status(400).send('Missing OAuth callback parameters.')
    return
  }

  let parsedState: { userId?: number } = {}
  try {
    parsedState = JSON.parse(
      Buffer.from(state, 'base64url').toString('utf8'),
    ) as { userId?: number }
  } catch {
    res.status(400).send('Invalid OAuth state.')
    return
  }

  if (typeof parsedState.userId !== 'number') {
    res.status(400).send('Invalid OAuth state user.')
    return
  }

  try {
    const { tokens, profile } = await exchangeCodeForTokens(code)
    if (!tokens.refresh_token) {
      throw new Error(
        'Google did not return a refresh token. Re-run consent with access_type=offline and prompt=consent.',
      )
    }
    if (!profile.emailAddress) {
      throw new Error('Gmail profile is missing email address.')
    }

    upsertGmailAccount(
      parsedState.userId,
      {
        sub: profile.emailAddress,
        email: profile.emailAddress,
      },
      tokens.refresh_token,
      tokens.scope ?? '',
    )

    res.redirect('/?gmailConnected=1')
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown OAuth callback error'
    res.status(500).send(`Google OAuth failed: ${message}`)
  }
})

router.get('/', (req, res) => {
  const gmailAccount = getGmailAccountForUser(req.sessionUser!.id)
  const statusMessage =
    typeof req.query.gmailConnected === 'string'
      ? 'Gmail account connected.'
      : typeof req.query.gmailDisconnected === 'string'
        ? 'Gmail account disconnected.'
        : undefined

  res.type('html').send(
    renderDashboardPage({
      userEmail: req.sessionUser!.email,
      gmailEmail: gmailAccount?.google_email,
      statusMessage,
    }),
  )
})

export default router
