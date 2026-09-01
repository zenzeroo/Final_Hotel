import { z } from 'zod'

/**
 * Environment variables (Zod-validated at boot).
 * Server-only vars (SERVICE_ROLE_KEY, R2 credentials) are NOT exposed to the client.
 */
const envSchema = z.object({
  // App
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  // Data Layer Toggle
  USE_MOCK_DATA: z
    .string()
    .default('1')
    .transform((v) => v !== '0'),

  // Supabase (Public — client-safe)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),

  // Supabase (Server-only)
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // Cloudflare R2 (Public — for image URLs)
  R2_PUBLIC_URL: z.string().url().default('https://pub-bd00e642ff7946b0b63fbec785554bf8.r2.dev'),
  R2_BUCKET_NAME: z.string().default('zenzero-hotel'),

  // Cloudflare R2 (Server-only)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),

  // Pricing
  NEXT_PUBLIC_TAX_RATE: z
    .string()
    .default('0.07')
    .transform((v) => parseFloat(v)),
  NEXT_PUBLIC_RESORT_FEE: z
    .string()
    .default('150')
    .transform((v) => parseInt(v, 10)),

  // Stripe (Public — client-safe publishable key)
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  // Stripe (Server-only — secret key + webhook signing secret)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables')
}

export const env = parsed.data

// Convenience flags
export const isUsingMockData = env.USE_MOCK_DATA
export const hasSupabase = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
export const hasR2 = Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY)
export const hasPaymentGateway = Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET)
