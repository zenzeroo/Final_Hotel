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

const { data: dmg } = await srv.from('damage_reports').select('id, description, resolved, created_at').order('created_at')
console.log('damage_reports rows:', dmg?.length)
for (const r of dmg ?? []) console.log('  -', r.id.slice(0, 8), '|', r.description?.slice(0, 60), '| resolved=', r.resolved, '|', r.created_at)

const { data: rf } = await srv.from('refund_requests').select('id, reason, status, created_at').order('created_at')
console.log('\nrefund_requests rows:', rf?.length)
for (const r of rf ?? []) console.log('  -', r.id.slice(0, 8), '|', r.reason?.slice(0, 60), '|', r.status, '|', r.created_at)

const { data: ru } = await srv.from('room_units').select('unit_label').order('unit_label')
console.log('\nroom_units (count):', ru?.length)
for (const r of ru ?? []) console.log('  -', r.unit_label)
