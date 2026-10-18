/**
 * Admin room-type → physical rooms (room_units) — live DB integration test.
 *
 * Exercises the data-layer helpers behind /admin/rates/room-types/[id]/edit
 * (lib/data/supabase-rooms.ts) with a service client against a throwaway
 * room type, then deletes everything it made.
 *
 *   npx tsx scripts/test-admin-room-units.mts
 */
import { config as loadEnv } from 'dotenv'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  createRoomUnit,
  setRoomUnitActive,
  countUnitsByRoomType,
  isRoomTypeSlugTaken,
} from '../lib/data/supabase-rooms'

loadEnv({ path: '.env.local' })
const svc = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)
// The helpers are typed for the cookie client; at runtime any supabase-js client works.
const db = svc as unknown as NonNullable<Parameters<typeof createRoomUnit>[1]>

let passed = 0
let failed = 0
async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    failed++
    console.log(`  ✗ ${name}\n    ${(e as Error).message}`)
  }
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}
async function errorOf(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn()
    return ''
  } catch (e) {
    return (e as Error).message
  }
}

const slug = `test-units-${Date.now()}`
// Floor 49 keeps the throwaway unit label clear of real rooms (unique floor+label).
const FLOOR = 49
const { data: rt, error: rtErr } = await svc
  .from('room_types')
  .insert({
    slug,
    name: 'Units Test',
    name_th: 'ทดสอบห้องจริง',
    short_desc: 'test',
    description: 'test',
    type: 'Deluxe',
    bed_type: 'King',
    floor: FLOOR,
    base_price: 1000,
    max_guests: 2,
    size_sqm: 20,
    hero_image_key: '',
    gallery_keys: [],
    amenities: [],
    is_active: false,
  })
  .select('id')
  .single()
assert(!rtErr && rt, `room type insert: ${rtErr?.message}`)
console.log(`Using temp room type ${slug} (${rt.id})`)

const unitId = async () =>
  (await svc.from('room_units').select('id').eq('room_type_id', rt.id).single()).data!.id as string

try {
  await step('slug check sees an existing slug, not a fresh one', async () => {
    assert(await isRoomTypeSlugTaken(slug, db), 'existing slug reported free')
    assert(!(await isRoomTypeSlugTaken(`${slug}-nope`, db)), 'fresh slug reported taken')
  })

  await step('new type starts with 0 active units', async () => {
    const counts = await countUnitsByRoomType(db)
    assert((counts[rt.id] ?? 0) === 0, `count=${counts[rt.id]}`)
  })

  await step('createRoomUnit adds an available, active unit', async () => {
    await createRoomUnit({ roomTypeId: rt.id, floor: FLOOR, unitLabel: 'T-01', viewLabel: null }, db)
    const { data } = await svc.from('room_units').select('status, is_active').eq('room_type_id', rt.id)
    assert(data?.length === 1, `units=${data?.length}`)
    assert(data[0].status === 'available' && data[0].is_active, JSON.stringify(data[0]))
    const counts = await countUnitsByRoomType(db)
    assert(counts[rt.id] === 1, `count=${counts[rt.id]}`)
  })

  await step('same floor + label is refused with a Thai message', async () => {
    const msg = await errorOf(() =>
      createRoomUnit({ roomTypeId: rt.id, floor: FLOOR, unitLabel: 'T-01', viewLabel: null }, db),
    )
    assert(msg === 'มีห้องเลขนี้ในชั้นนี้อยู่แล้ว', `got "${msg}"`)
  })

  await step('an occupied unit cannot be switched off', async () => {
    const id = await unitId()
    await svc.from('room_units').update({ status: 'occupied' }).eq('id', id)
    const msg = await errorOf(() => setRoomUnitActive({ unitId: id, active: false }, db))
    assert(/ปิดไม่ได้/.test(msg), `expected refusal, got "${msg}"`)
    await svc.from('room_units').update({ status: 'available' }).eq('id', id)
  })

  await step('a free unit switches off and on; count follows', async () => {
    const id = await unitId()
    await setRoomUnitActive({ unitId: id, active: false }, db)
    assert(((await countUnitsByRoomType(db))[rt.id] ?? 0) === 0, 'still counted after off')
    await setRoomUnitActive({ unitId: id, active: true }, db)
    assert((await countUnitsByRoomType(db))[rt.id] === 1, 'not counted after on')
  })
} finally {
  await svc.from('room_units').delete().eq('room_type_id', rt.id)
  await svc.from('room_types').delete().eq('id', rt.id)
  const { count } = await svc
    .from('room_types')
    .select('id', { count: 'exact', head: true })
    .eq('slug', slug)
  console.log(`Cleanup: temp room type ${count === 0 ? 'removed' : 'STILL PRESENT'}`)
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
