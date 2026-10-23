import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser-side Supabase client (used in Client Components).
 * Reads/writes cookies via the browser.
 *
 * Reads `process.env.NEXT_PUBLIC_*` by literal name: Next only inlines env
 * vars into client bundles when they are written out like this, so going
 * through `lib/env.ts` (which parses the whole `process.env` object) would
 * always see them as missing in the browser.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error(
      'Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
    )
  }
  return createBrowserClient(url, anonKey)
}
