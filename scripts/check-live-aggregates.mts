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

const { data: bks } = await srv.from('bookings').select('id, booking_code, status, total_amount, payment_status, check_in').order('check_in', { ascending: false })
console.log('total bookings:', bks?.length)
console.log('by status:')
const byStatus: Record<string, number> = {}
for (const b of bks ?? []) byStatus[b.status] = (byStatus[b.status] ?? 0) + 1
console.log(JSON.stringify(byStatus, null, 2))
console.log('\nfirst 5 booking_codes:', (bks ?? []).slice(0, 5).map((b: any) => b.booking_code))
console.log('active (pending|confirmed|checked_in):', Object.entries(byStatus).filter(([s]) => ['pending', 'confirmed', 'checked_in'].includes(s)).reduce((a, [, c]) => a + c, 0))

const { data: ev } = await srv.from('booking_events').select('event_type, description, created_at')
console.log('\nbooking_events:', ev?.length)
for (const e of ev ?? []) console.log('  -', e.event_type, '|', (e.description ?? '').slice(0, 50), '|', e.created_at)
