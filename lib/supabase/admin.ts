import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { env, hasSupabase } from '../env'

/**
 * Server-side Supabase client using the SERVICE ROLE key.
 *
 * Use ONLY for admin operations that require bypassing RLS, e.g.:
 *  - `auth.admin.createUser` / `auth.admin.deleteUser`
 *  - Bulk migrations
 *
 * NEVER import this from a Client Component or expose its return value
 * to the browser. The service role key bypasses all security policies.
 *
 * Throws if Supabase is not configured or the service role key is missing.
 */
export async function createAdminClient() {
  if (!hasSupabase) {
    throw new Error(
      'Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local',
    )
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required for admin operations. Add it to .env.local.',
    )
  }

  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
