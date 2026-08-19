import { createBrowserClient } from '@supabase/ssr'
import { env, hasSupabase } from '../env'

/**
 * Browser-side Supabase client (used in Client Components).
 * Reads/writes cookies via the browser.
 */
export function createClient() {
  if (!hasSupabase) {
    throw new Error(
      'Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
    )
  }
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}
