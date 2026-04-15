import { config as loadEnv } from 'dotenv'
import { z } from 'zod'

loadEnv()

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  APP_BASE_URL: z.string().url(),
  TOKEN_ENCRYPTION_SECRET: z.string().min(16),
  DEMO_USER_EMAIL: z.string().email(),
  DEMO_USER_PASSWORD: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().url(),
  GEMINI_API_KEY: z.string().min(1),
})

export const env = envSchema.parse({
  PORT: process.env.PORT ?? 3000,
  APP_BASE_URL: process.env.APP_BASE_URL ?? 'http://localhost:3000',
  TOKEN_ENCRYPTION_SECRET: process.env.TOKEN_ENCRYPTION_SECRET,
  DEMO_USER_EMAIL: process.env.DEMO_USER_EMAIL ?? 'demo@example.com',
  DEMO_USER_PASSWORD: process.env.DEMO_USER_PASSWORD ?? 'change-me-now',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? '',
  GOOGLE_REDIRECT_URI:
    process.env.GOOGLE_REDIRECT_URI ??
    'http://localhost:3000/auth/google/callback',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? '',
})

export const GMAIL_READONLY_SCOPE =
  'https://www.googleapis.com/auth/gmail.readonly'
