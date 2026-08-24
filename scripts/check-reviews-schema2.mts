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

const { data: rs, error: e2 } = await srv.from('reviews').select('*').limit(1)
console.log('err:', e2?.message)
console.log('keys:', rs ? Object.keys(rs[0] ?? {}) : '<empty>')

// Try insert with no moderated_at
const { data: g } = await srv.from('profiles').select('id').eq('role', 'user').limit(1)
const { data: rt } = await srv.from('room_types').select('id').limit(1)
if (g && rt && g[0] && rt[0]) {
  const probe = await srv.from('reviews').insert({
    user_id: g[0].id,
    room_type_id: rt[0].id,
    rating: 5,
    body: 'schema probe',
    status: 'pending',
  }).select('id').single()
  console.log('probe insert err:', probe.error?.message)
  if (probe.data) {
    console.log('  inserted id:', probe.data.id)
    await srv.from('reviews').delete().eq('id', probe.data.id)
    console.log('  deleted probe row')
  }
}
