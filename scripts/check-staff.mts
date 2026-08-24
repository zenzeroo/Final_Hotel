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

const { data: profs } = await srv.from('profiles').select('id, full_name, role, is_active, email')
console.log('profiles:', profs?.length)
for (const p of profs ?? []) console.log('  -', p.id.slice(0, 8), '|', p.role, '|', p.is_active ? 'active' : 'inactive', '|', p.full_name)

const { data: shifts } = await srv.from('staff_shifts').select('staff_id, shift_date, position').order('shift_date').limit(20)
console.log('\nstaff_shifts:', shifts?.length)
for (const s of shifts ?? []) console.log('  -', s.staff_id.slice(0, 8), '|', s.shift_date, '|', s.position)

const { data: rev } = await srv.from('reviews').select('id, status, title, body').order('created_at')
console.log('\nreviews:', rev?.length)
for (const r of rev ?? []) console.log('  -', r.id.slice(0, 8), '|', r.status, '|', (r.title ?? '').slice(0, 40))
