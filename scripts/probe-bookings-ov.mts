import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServerClient } from '@supabase/ssr'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const cookies: any[] = []
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      getAll: () => cookies.map((c) => ({ name: c.name, value: c.value })),
      setAll: (toSet) => { for (const { name, value, options } of toSet) cookies.push({ name, value, opts: options }) },
    },
  },
)
await supabase.auth.signInWithPassword({ email: 'manager@zenzero.com', password: process.env.MANAGER_TEST_PASSWORD ?? 'ManagerPass123!' })
const cookieHeader = cookies.map((c) => c.name + '=' + c.value).join('; ')

// Make the booking-events FK probe by calling the same route handler chain via
// service_role — easier to bypass RLS for diagnostic.
const { createClient: cc } = await import('@supabase/supabase-js')
const srv = cc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// 1. Test the embedded query the way supabase-manager does it
const { data: bk, error: ek1 } = await srv
  .from('booking_events')
  .select(`id, event_type, description, created_at, metadata,
        actor:profiles!booking_events_actor_id_fkey(full_name, role),
        booking:bookings(booking_code)`)
  .order('created_at', { ascending: false })
  .limit(50)

console.log('booking_events embed →', { count: bk?.length ?? 0, err: ek1?.message })

// 2. Test the refund query
const { data: rr, error: ek2 } = await srv
  .from('refund_requests')
  .select('id, booking_code, guest_name')
  .eq('status', 'pending')

console.log('refund_requests (pending) →', { count: rr?.length ?? 0, err: ek2?.message })

// 3. Test the bookings embed
const { data: bo, error: ek3 } = await srv
  .from('bookings')
  .select(`id, booking_code, booker_full_name, check_in, check_out, nights, status,
      room_type:room_types(name)`)
  .in('status', ['confirmed', 'checked_in', 'pending', 'cancelled', 'refunded'])
  .order('check_in', { ascending: false })
  .limit(50)

console.log('bookings embed →', { count: bo?.length ?? 0, err: ek3?.message })
