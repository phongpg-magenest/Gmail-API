# Gmail Demo Implementation Plan

## Goal

Build a minimal demo in `/home/phong/PROJECT/Mail` where:

1. A user logs into the demo system with the demo's own auth.
2. The user connects Gmail once through Google OAuth.
3. The system stores the Gmail refresh token securely enough for demo use.
4. On later logins, the user only needs to log into the demo system.
5. The backend can fetch Gmail messages via API with filters.

This plan is for the `OAuth + refresh token` approach, not service accounts.

## Demo Scope

### In scope

- Minimal backend app
- Minimal demo auth for the app itself
- Google OAuth connect flow
- Refresh token storage
- Gmail list messages endpoint with filter support
- Gmail get message detail endpoint
- Local SQLite storage for demo
- README with setup instructions

### Out of scope

- Production auth hardening
- Multi-tenant RBAC
- Background sync jobs
- Attachment download in v1
- Gmail push notifications / watch
- Full frontend polish
- Admin UI

## Recommended Stack

- Runtime: Node.js or Bun-compatible Node runtime
- Backend: Express
- Storage: SQLite
- ORM/query layer: lightweight, likely direct SQL or a small query lib
- Google API client: official `googleapis` package
- Session/auth for demo app: cookie session or signed token cookie

Reason:

- Fastest path to working demo
- Low operational overhead
- Easy local testing

## High-Level Architecture

### Components

1. Demo app auth layer
2. Google OAuth connector
3. Gmail service layer
4. SQLite persistence layer
5. Small web UI or minimal server-rendered pages for manual testing

### Core flows

1. Demo login
2. Connect Gmail
3. OAuth callback
4. Refresh access token
5. Fetch filtered messages
6. Read message details

## User Flows

### Flow A: First-time Gmail connection

1. User logs into the demo app with demo credentials.
2. User lands on a dashboard.
3. User clicks `Connect Gmail`.
4. Backend redirects to Google OAuth consent.
5. User logs into Google with `phongpg@magenest`.
6. Google redirects back to the app callback URL.
7. Backend exchanges auth code for tokens.
8. Backend stores:
   - `google_sub`
   - `google_email`
   - `refresh_token`
   - granted scopes
9. Dashboard shows Gmail connected.

### Flow B: Later usage

1. User logs into demo app.
2. Backend looks up saved Gmail connection for that demo user.
3. Backend uses stored refresh token to obtain a fresh access token.
4. Backend calls Gmail API.
5. User can search/list messages with a filter query.

## Gmail API Usage

### Primary endpoints

1. `users.messages.list`
2. `users.messages.get`

### Planned API parameters

#### List messages

- `userId=me`
- `maxResults`
- `q`
- `labelIds`
- `pageToken` later if needed

#### Get message

- `userId=me`
- `id`
- `format=metadata` initially, maybe `full`
- metadata headers of interest:
  - `From`
  - `To`
  - `Subject`
  - `Date`

### Filter examples

- `in:inbox newer_than:7d`
- `from:abc@example.com`
- `label:unread`
- `has:attachment`

## Auth Design

### Demo system auth

For the demo, use a simple local user table:

- `email`
- `password_hash`

Seed one demo user manually or via setup script.

Reason:

- The demo requirement says the user first logs into the demo system.
- We need a stable internal user ID to map to Gmail credentials.

### Gmail OAuth

Use Google OAuth 2.0 with offline access:

- `access_type=offline`
- `prompt=consent`

Reason:

- We need `refresh_token` for future API access after demo login only.

### Required Gmail scope

Initial scope:

- `https://www.googleapis.com/auth/gmail.readonly`

Reason:

- Enough for reading and filtering mail
- Lower risk than broader scopes

## Data Model

### Table: `users`

- `id`
- `email`
- `password_hash`
- `created_at`
- `updated_at`

### Table: `gmail_accounts`

- `id`
- `user_id`
- `google_sub`
- `google_email`
- `refresh_token_encrypted`
- `scope`
- `created_at`
- `updated_at`

### Optional later fields

- `token_last_refreshed_at`
- `last_sync_at`
- `status`

## Security Model For Demo

### Acceptable for demo

- Store refresh token encrypted using an app secret from env
- Use HTTP-only session cookie
- Keep credentials and tokens out of git

### Not acceptable

- Store refresh token plaintext
- Commit OAuth credentials into the repo
- Use Gmail password directly

### Secrets to keep in env

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `APP_SESSION_SECRET`
- `TOKEN_ENCRYPTION_SECRET`

If using file-based Google credentials instead:

- `credentials.json` stays local-only and gitignored

## API Endpoints To Implement

### Demo auth

1. `GET /login`
2. `POST /login`
3. `POST /logout`

### Gmail connect

1. `GET /auth/google/start`
2. `GET /auth/google/callback`
3. `POST /gmail/disconnect`

### Gmail read

1. `GET /gmail/messages`
2. `GET /gmail/messages/:id`

### Example query contract

#### `GET /gmail/messages`

Query params:

- `q`
- `labelIds`
- `maxResults`

Example:

```http
GET /gmail/messages?q=in:inbox%20newer_than:7d&maxResults=10
```

Response shape:

```json
{
  "connectedAccount": "phongpg@magenest",
  "query": "in:inbox newer_than:7d",
  "messages": [
    {
      "id": "message-id",
      "threadId": "thread-id"
    }
  ]
}
```

#### `GET /gmail/messages/:id`

Response shape:

```json
{
  "id": "message-id",
  "threadId": "thread-id",
  "snippet": "message snippet",
  "headers": {
    "subject": "Subject line",
    "from": "sender@example.com",
    "date": "Thu, 10 Apr 2026 08:00:00 +0700"
  }
}
```

## UI Plan

Minimal web UI only.

### Pages

1. Login page
2. Dashboard page

### Dashboard widgets

- Demo user identity
- Gmail connection status
- `Connect Gmail` button
- Filter input
- `Fetch messages` button
- Message list
- Message detail panel or JSON block

This can be server-rendered HTML first to reduce complexity.

## Files Planned

### Root

- `package.json`
- `.gitignore`
- `.env.example`
- `README.md`
- `IMPLEMENTATION_PLAN.md`

### Source

- `src/server.ts`
- `src/config.ts`
- `src/db.ts`
- `src/auth/session.ts`
- `src/auth/demoUser.ts`
- `src/google/oauth.ts`
- `src/google/gmail.ts`
- `src/routes/auth.ts`
- `src/routes/gmail.ts`
- `src/views/...` if using server-rendered HTML

## Setup Requirements From User

I need these before the demo can actually run against Gmail:

1. Google Cloud project with Gmail API enabled
2. OAuth client credentials
3. Redirect URI registered in Google Cloud
4. Confirmation that `phongpg@magenest` can complete OAuth consent

### Best setup choice

For local demo:

- OAuth client type: `Web application`
- Redirect URI:
  - `http://localhost:3000/auth/google/callback`

Alternative:

- `Desktop app` is possible, but for this demo a web app callback fits the server flow better.

## Local Development Plan

### Phase 1: Scaffold

1. Initialize project
2. Add dependencies
3. Set up server bootstrap
4. Set up SQLite
5. Add gitignore and env example

### Phase 2: Demo auth

1. Create users table
2. Seed one demo user
3. Add login route
4. Add session cookie
5. Add auth middleware

### Phase 3: Google OAuth

1. Generate OAuth URL
2. Handle callback
3. Exchange code for tokens
4. Fetch Google profile identity
5. Save encrypted refresh token

### Phase 4: Gmail fetch

1. Build Gmail client from refresh token
2. Implement message list endpoint
3. Implement message detail endpoint
4. Normalize headers for response

### Phase 5: Demo UI

1. Login page
2. Dashboard page
3. Connect Gmail button
4. Filter input + fetch action
5. Message display

### Phase 6: Documentation

1. Setup guide
2. Google Cloud credential instructions
3. Local run instructions
4. Known limitations

## Acceptance Criteria

The demo is complete when all of these are true:

1. A demo user can log into the app.
2. The user can connect Gmail through Google OAuth.
3. The app stores a reusable refresh token.
4. After logout/login, the app can still fetch Gmail without asking Google login again.
5. The app can fetch filtered messages using `q`.
6. The app can display message details for a selected message.
7. Secrets are not committed to git.
8. README documents setup clearly.

## Risks

### Workspace policy risk

`phongpg@magenest` may be subject to Google Workspace restrictions:

- OAuth app restrictions
- unverified app restrictions
- internal app policy

Mitigation:

- Use a Google Cloud project allowed by the Workspace policy
- Test OAuth early before building too much around it

### Refresh token issuance risk

Google may not always return a refresh token on repeated consent.

Mitigation:

- request `access_type=offline`
- force `prompt=consent` in demo flow

### Token storage risk

For demo, encryption is enough; for production, secret management would need improvement.

## Verification Plan

### Manual checks

1. Login with demo credentials
2. Connect Gmail with `phongpg@magenest`
3. Confirm Gmail account is shown as connected
4. Fetch inbox messages with:
   - `in:inbox`
   - `newer_than:7d`
5. Open one message detail
6. Logout and login again
7. Fetch again without redoing Google login

### Implementation verification

- Route tests where practical
- manual OAuth flow verification
- SQLite data inspection for stored account mapping

## Open Questions

These need to be confirmed before implementation:

1. Do you want Express only, or a framework like Next.js/NestJS?
2. Is local demo enough, or must it run on a shared internal server?
3. Do you want only JSON endpoints, or a minimal browser UI too?
4. Is `gmail.readonly` enough for this demo?
5. Will you provide OAuth client credentials as env vars or `credentials.json`?

## Recommended Next Step

After plan approval:

1. Scaffold Express + SQLite project
2. Implement demo login
3. Implement Google OAuth connect flow
4. Implement Gmail filtered fetch
5. Add README and `.env.example`
