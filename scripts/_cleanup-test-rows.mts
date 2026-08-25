/**
 * Cleanup leaked Phase 10 test bookings using service role key.
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const r = createClient(url, serviceKey)
const { data, error } = await r.from('bookings').delete().like('booking_code', 'ZZR-P10-%').select('id')
if (error) {
  console.error('Delete failed:', error.message)
  process.exit(1)
}
console.log('Deleted leaked rows:', data?.length ?? 0)
