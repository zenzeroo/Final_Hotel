import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const { createClient } = await import('@supabase/supabase-js')
const srv = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const { data: cols, error: e } = await srv.rpc('get_columns', { t: 'reviews' }).then(() => null).catch(() => null)
// Just select a single row to see schema
const { data: rs, error: e2 } = await srv.from('reviews').select('*').limit(0)
console.log('error:', e2?.message)
console.log('keys:', rs ? Object.keys(rs[0] ?? {}) : '[]')
