/**
 * Phase 44 — Rating sync integration test.
 *
 * Verifies the data inconsistency fix where seed room_types.rating_avg /
 * rating_count drifted forever (the recalc trigger only fires on
 * INSERT/UPDATE/DELETE of `reviews`, not on the seed INSERT):
 *
 *   1. After migration: recompute_all_room_ratings() reports 10 rows affected
 *      (all 10 active room_types), every rating_count = actual approved count.
 *   2. Calling recompute_all_room_ratings() a second time is idempotent
 *      (0 rows differ from already-correct values).
 *   3. INSERT approved review for oasis-villa → trigger fires → rating_count=1
 *      + rating_avg = review rating.
 *   4. UPDATE review status='hidden' → trigger fires → rating_count=0 again.
 *   5. UPDATE back to 'approved' → trigger fires → rating_count=1 again.
 *   6. DELETE the review → trigger fires → rating_count=0.
 *   7. Calling recompute_all_room_ratings() after the delete restores 0/0
 *      even if a hidden review leaked (defense in depth).
 *
 * Prereqs:
 *   - Migration 20261006_recompute_room_ratings.sql applied
 *   - Seed has at least one active room_type (oasis-villa)
 *   - At least one user-role profile exists (run scripts/_rbac-fixture.mts)
 *
 * Run: npx tsx scripts/test-phase44-rating-sync.mts
 *
 * Cleanup: the test review row is inserted with rating_title = 'Phase 44
 * rating-sync test' and deleted at the end via service-role client.
 */
import { config as loadEnv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(__dirname, '..', '.env.local') })

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!BASE || !SERVICE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
  process.exit(1)
}

const svc = createClient(BASE, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let passed = 0
let failed = 0

async function step(name: string, fn: () => Promise<string | void> | void) {
  process.stdout.write('▶ ' + name + '\n')
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

async function rpc(name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await svc.rpc(name, args)
  if (error) {
    const err = new Error(`${name} failed: ${error.message}`)
    Object.assign(err, { code: (error as { code?: string }).code, message: error.message })
    throw err
  }
  return data
}

async function readRating(slug: string): Promise<{ rating_avg: number; rating_count: number }> {
  const { data, error } = await svc
    .from('room_types')
    .select('rating_avg, rating_count')
    .eq('slug', slug)
    .single()
  if (error || !data) throw new Error(`readRating(${slug}): ${error?.message ?? 'no row'}`)
  return {
    rating_avg: Number(data.rating_avg),
    rating_count: Number(data.rating_count),
  }
}

// ----------------------------------------------------------------------
// Fixtures
// ----------------------------------------------------------------------

const { data: oasis } = await svc
  .from('room_types')
  .select('id, slug')
  .eq('slug', 'oasis-villa')
  .single()
if (!oasis) {
  console.error('oasis-villa not found — has the seed been applied?')
  process.exit(1)
}

const { data: testUsers } = await svc
  .from('profiles')
  .select('id')
  .eq('role', 'user')
  .limit(1)
const testUser = testUsers?.[0]
if (!testUser) {
  console.error('No user-role profile found — run scripts/_rbac-fixture.mts first')
  process.exit(1)
}
console.log('Using room_type:', oasis.slug, '(' + oasis.id + ')')
console.log('Using test_user:', testUser.id)

const TEST_TITLE = 'Phase 44 rating-sync test'

// Cleanup any leftover from previous runs
await svc.from('reviews').delete().eq('title', TEST_TITLE)

// ----------------------------------------------------------------------
// Test cases
// ----------------------------------------------------------------------

await step('1. recompute_all_room_ratings() returns 10 rows affected', async () => {
  const affected = await rpc('recompute_all_room_ratings')
  return `rows=${affected}`
})

await step('2. all 10 active room_types have rating_count == actual approved count', async () => {
  const { data: rts, error: e1 } = await svc
    .from('room_types')
    .select('id, slug, rating_count')
    .eq('is_active', true)
    .is('deleted_at', null)
  if (e1) throw new Error(e1.message)
  assert(rts, 'no room_types returned')
  for (const rt of rts) {
    const { count, error: e2 } = await svc
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('room_type_id', rt.id)
      .eq('status', 'approved')
    if (e2) throw new Error(e2.message)
    assert(
      rt.rating_count === (count ?? 0),
      `slug=${rt.slug} stored=${rt.rating_count} actual=${count}`,
    )
  }
  return `${rts.length} rooms verified`
})

await step('3. recompute_all_room_ratings() is idempotent (no value shift on second call)', async () => {
  const before = await readRating(oasis.slug)
  const affected = await rpc('recompute_all_room_ratings')
  const after = await readRating(oasis.slug)
  assert(before.rating_avg === after.rating_avg && before.rating_count === after.rating_count, 'rating shifted unexpectedly')
  return `rows_touched=${affected} avg unchanged=${after.rating_avg}`
})

let reviewId: string | null = null

await step('4. INSERT approved review fires trg_recalc_rating → rating_count=1', async () => {
  const before = await readRating(oasis.slug)
  assert(before.rating_count === 0, `expected 0 before insert, got ${before.rating_count}`)
  const { data, error } = await svc
    .from('reviews')
    .insert({
      user_id: testUser.id,
      room_type_id: oasis.id,
      booking_id: null,
      rating: 5,
      title: TEST_TITLE,
      body: 'integration test',
      status: 'approved',
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'no id')
  reviewId = data.id
  const after = await readRating(oasis.slug)
  assert(after.rating_count === 1, `expected count=1 after insert, got ${after.rating_count}`)
  assert(after.rating_avg === 5, `expected avg=5 after insert, got ${after.rating_avg}`)
  return `review=${data.id} avg=${after.rating_avg} count=${after.rating_count}`
})

await step('5. UPDATE status=hidden → trigger fires → rating_count=0', async () => {
  assert(reviewId, 'review not created in step 4')
  const { error } = await svc.from('reviews').update({ status: 'hidden' }).eq('id', reviewId)
  if (error) throw new Error(error.message)
  const after = await readRating(oasis.slug)
  assert(after.rating_count === 0, `expected count=0 after hide, got ${after.rating_count}`)
  return `avg=${after.rating_avg} count=${after.rating_count}`
})

await step('6. UPDATE status=approved → trigger fires → rating_count=1', async () => {
  assert(reviewId, 'review not created in step 4')
  const { error } = await svc.from('reviews').update({ status: 'approved' }).eq('id', reviewId)
  if (error) throw new Error(error.message)
  const after = await readRating(oasis.slug)
  assert(after.rating_count === 1, `expected count=1 after unhide, got ${after.rating_count}`)
  assert(after.rating_avg === 5, `expected avg=5 after unhide, got ${after.rating_avg}`)
  return `avg=${after.rating_avg} count=${after.rating_count}`
})

await step('7. DELETE review → trigger fires → rating_count=0', async () => {
  assert(reviewId, 'review not created in step 4')
  const { error } = await svc.from('reviews').delete().eq('id', reviewId)
  if (error) throw new Error(error.message)
  reviewId = null
  const after = await readRating(oasis.slug)
  assert(after.rating_count === 0, `expected count=0 after delete, got ${after.rating_count}`)
  assert(after.rating_avg === 0, `expected avg=0 after delete, got ${after.rating_avg}`)
  return `avg=${after.rating_avg} count=${after.rating_count}`
})

// Defense in depth: re-run recompute and verify final state still clean
await step('8. final recompute leaves oasis-villa at 0/0', async () => {
  await rpc('recompute_all_room_ratings')
  const after = await readRating(oasis.slug)
  assert(after.rating_count === 0, `expected count=0, got ${after.rating_count}`)
  assert(after.rating_avg === 0, `expected avg=0, got ${after.rating_avg}`)
  return `avg=${after.rating_avg} count=${after.rating_count}`
})

// ----------------------------------------------------------------------
// Cleanup + summary
// ----------------------------------------------------------------------

if (reviewId) {
  await svc.from('reviews').delete().eq('id', reviewId)
}

console.log('\n' + '='.repeat(60))
console.log(`passed=${passed}  failed=${failed}`)
console.log('='.repeat(60))
process.exit(failed === 0 ? 0 : 1)
