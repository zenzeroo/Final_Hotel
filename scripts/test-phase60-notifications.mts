/**
 * Phase 60 — in-app notifications.
 *
 * Cases:
 *   1. notifications is in the supabase_realtime publication
 *   2. notifyUser inserts once; the same eventKey again is ignored
 *   3. owner reads own rows; another user and anon see nothing
 *   4. owner can set read_at but not change type; cannot touch another user's row
 *   5. notifyRoles(['manager']) reaches every active manager and nobody else
 *   6. booking flipped to expired (payment_deadline) → one booking_expired row, idempotent
 *   7. realtime: a signed-in subscriber receives its own INSERT
 *
 * Prereqs: migration 20261017_notifications.sql applied.
 * Run: npx tsx scripts/test-phase60-notifications.mts
 * Cleanup: temp users p60-*@zenzero.test (rows cascade) + bookings ZZR-P60-*.
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
if (!BASE || !SERVICE_KEY || !ANON_KEY) {
  console.error('Supabase env vars required in .env.local')
  process.exit(1)
}
// Loaded after dotenv so lib/env.ts sees the variables.
const { notifyUser, notifyRoles } = await import('../lib/notifications/notify')
const { pgPoolerConfig } = await import('./_db-connection.mjs')

const opts = { auth: { autoRefreshToken: false, persistSession: false } }
const svc = createClient(BASE, SERVICE_KEY, opts)

let passed = 0
let failed = 0
async function step(name: string, fn: () => Promise<string | void>) {
  try {
    const r = await fn()
    console.log('  ✓ ' + name + (r ? ' — ' + r : ''))
    passed++
  } catch (e) {
    console.log('  ✗ ' + name + ' — ' + (e as Error).message)
    failed++
  }
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

const PREFIX = 'ZZR-P60-'
const RUN = Date.now()
const createdUsers: string[] = []

async function makeUser(tag: string): Promise<{ id: string; client: SupabaseClient }> {
  const email = `p60-${tag}-${RUN}@zenzero.test`
  const password = 'P60-Test-Pass1!'
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`)
  createdUsers.push(data.user.id)
  const client = createClient(BASE, ANON_KEY, opts)
  const { error: se } = await client.auth.signInWithPassword({ email, password })
  if (se) throw new Error(`sign-in: ${se.message}`)
  return { id: data.user.id, client }
}

async function cleanup() {
  const { data: rows } = await svc.from('bookings').select('id').like('booking_code', `${PREFIX}%`)
  if (rows?.length) {
    const ids = rows.map((b) => b.id)
    await svc.from('notifications').delete().in('booking_id', ids)
    await svc.from('booking_events').delete().in('booking_id', ids)
    await svc.from('bookings').delete().in('id', ids)
  }
  await svc.from('notifications').delete().like('event_key', 'p60:%')
  for (const id of createdUsers.splice(0)) await svc.auth.admin.deleteUser(id)
}

console.log('Phase 60 — notifications')
await cleanup()

const a = await makeUser('a')
const b = await makeUser('b')

try {
  await step('1. table is in the supabase_realtime publication', async () => {
    const client = new pg.Client(pgPoolerConfig())
    await client.connect()
    try {
      const res = await client.query(
        `select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications'`,
      )
      assert(res.rowCount === 1, 'not in publication')
    } finally {
      await client.end()
    }
  })

  await step('2. notifyUser inserts once; duplicate eventKey ignored', async () => {
    const input = { type: 'task_assigned' as const, params: { count: 2 }, link: '/housekeeper', eventKey: `p60:dup:${RUN}` }
    await notifyUser(a.id, input)
    await notifyUser(a.id, input)
    const { count } = await svc
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('event_key', input.eventKey)
    assert(count === 1, `expected 1 row, got ${count}`)
  })

  await step('3. owner reads own rows; other user + anon see nothing', async () => {
    const own = await a.client.from('notifications').select('id, type, params')
    assert(!own.error && own.data?.length === 1, `owner got ${own.data?.length} (${own.error?.message})`)
    assert(own.data[0].params.count === 2, 'params round-trip')
    const other = await b.client.from('notifications').select('id')
    assert(!other.error && other.data?.length === 0, `other user saw ${other.data?.length}`)
    const anon = await createClient(BASE, ANON_KEY, opts).from('notifications').select('id')
    assert((anon.data?.length ?? 0) === 0, `anon saw ${anon.data?.length}`)
  })

  await step('4. owner may set read_at only; cannot touch another user’s row', async () => {
    const { data: row } = await svc.from('notifications').select('id').eq('event_key', `p60:dup:${RUN}`).single()
    const ok = await a.client.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', row!.id).select('read_at')
    assert(!ok.error && ok.data?.[0]?.read_at, `read_at update failed: ${ok.error?.message}`)
    const bad = await a.client.from('notifications').update({ type: 'booking_new' }).eq('id', row!.id)
    assert(bad.error, 'type update should be refused')
    await svc.from('notifications').update({ read_at: null }).eq('id', row!.id)
    const foreign = await b.client.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', row!.id).select('id')
    assert(!foreign.error && foreign.data?.length === 0, 'other user updated the row')
    const { data: after } = await svc.from('notifications').select('read_at').eq('id', row!.id).single()
    assert(after!.read_at === null, 'row changed by another user')
  })

  await step('5. notifyRoles reaches active managers only', async () => {
    const key = `p60:roles:${RUN}`
    await notifyRoles(['manager'], { type: 'refund_requested_new', params: { code: 'X', amount: 1 }, link: '/manager/bookings?tab=refunds', eventKey: key })
    const { data: managers } = await svc.from('profiles').select('id').eq('role', 'manager').eq('is_active', true)
    const { data: rows } = await svc.from('notifications').select('user_id').like('event_key', `${key}:%`)
    const want = new Set((managers ?? []).map((m) => m.id))
    const got = new Set((rows ?? []).map((r) => r.user_id))
    assert(want.size > 0, 'no active manager to test with')
    assert(got.size === want.size && [...got].every((id) => want.has(id)), `managers ${want.size}, rows ${got.size}`)
    return `${got.size} manager(s)`
  })

  await step('6. payment-deadline expiry → one booking_expired row (idempotent)', async () => {
    const { data: roomType } = await svc.from('room_types').select('id').eq('is_active', true).is('deleted_at', null).limit(1).single()
    const day = 1 + (RUN % 250)
    const checkIn = new Date(Date.UTC(2034, 0, day)).toISOString().slice(0, 10)
    const checkOut = new Date(Date.UTC(2034, 0, day + 1)).toISOString().slice(0, 10)
    const code = `${PREFIX}${RUN}`
    const { data: id, error } = await svc.rpc('create_booking', {
      p_user_id: a.id, p_room_type_id: roomType!.id, p_check_in: checkIn, p_check_out: checkOut,
      p_guests: 1, p_nights: 1, p_base_subtotal: 1000, p_discount_total: 0, p_tax_total: 0,
      p_fee_total: 0, p_total: 1000, p_currency: 'THB', p_promotion_id: null,
      p_cancellation_policy_id: null, p_booker_full_name: 'P60 Test',
      p_booker_email: 'p60@zenzero.test', p_booker_phone: '0890000060',
      p_special_request: null, p_channel: 'web', p_booking_code: code,
    })
    assert(!error && id, `create_booking: ${error?.message}`)
    for (let i = 0; i < 2; i++) {
      const { error: ue } = await svc.from('bookings').update({ status: 'expired', lapsed_reason: 'payment_deadline' }).eq('id', id as string)
      assert(!ue, `expire: ${ue?.message}`)
    }
    const { data: rows } = await svc.from('notifications').select('type, params, link').eq('booking_id', id as string)
    assert(rows?.length === 1, `expected 1 row, got ${rows?.length}`)
    assert(rows[0].type === 'booking_expired' && rows[0].params.code === code, 'wrong row')
  })

  await step('7. realtime delivers the owner’s INSERT', async () => {
    const key = `p60:rt:${RUN}`
    const received = new Promise<string>((resolveP, rejectP) => {
      const timer = setTimeout(() => rejectP(new Error('no realtime event within 15s')), 15_000)
      const ch = a.client
        .channel(`p60-${RUN}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${a.id}` }, (p) => {
          if ((p.new as { event_key?: string }).event_key === key) {
            clearTimeout(timer)
            void a.client.removeChannel(ch)
            resolveP('received')
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await notifyUser(a.id, { type: 'booking_new', params: { code: 'RT', checkIn: '2034-01-01' }, eventKey: key })
          }
        })
    })
    return await received
  })
} finally {
  await cleanup()
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
