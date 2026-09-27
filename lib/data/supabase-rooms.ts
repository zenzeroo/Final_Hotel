import type { Amenity, RoomType, SearchFilters, SearchResult } from './types'
import { hasSupabase } from '../env'
import { wrapSupabaseError } from '@/lib/errors/supabase'

/**
 * Supabase implementation — the only data layer (mock layer deleted).
 * Tables expected: room_types.
 *
 * Uses the server client (reads cookies) so authenticated writes
 * pass RLS via `auth.uid()` / `has_role('admin')`. Phase 3 originally
 * used a bare anon client which makes RLS denies any non-service-role
 * write — Phase 7 admin CRUD needed the session-aware client.
 */
async function getClient() {
  if (!hasSupabase) {
    throw new Error('Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  }
  const { createClient } = await import('@/lib/supabase/server')
  return await createClient()
}

export async function getFeaturedRooms(): Promise<RoomType[]> {
  const supabase = await getClient()
  const { data, error } = await supabase
    .from('room_types')
    .select('*')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('rating_avg', { ascending: false })
    .limit(4)

  if (error) wrapSupabaseError('', error)
  return (data ?? []) as RoomType[]
}

export async function getRoomBySlug(slug: string): Promise<RoomType | null> {
  const supabase = await getClient()
  const { data, error } = await supabase
    .from('room_types')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) wrapSupabaseError('', error)
  return (data as RoomType) ?? null
}

export async function searchRooms(filters: SearchFilters): Promise<SearchResult> {
  const supabase = await getClient()
  let query = supabase
    .from('room_types')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .is('deleted_at', null)

  if (filters.type && filters.type !== 'all') {
    query = query.eq('type', filters.type)
  }

  if (filters.floor !== undefined && filters.floor !== 'all') {
    query = query.eq('floor', filters.floor)
  }

  if (filters.guests && filters.guests > 0) {
    query = query.gte('max_guests', filters.guests)
  }

  if (filters.priceRange && filters.priceRange !== 'all') {
    if (filters.priceRange === 'under3000') query = query.lt('base_price', 3000)
    if (filters.priceRange === '3000-6000') query = query.gte('base_price', 3000).lte('base_price', 6000)
    if (filters.priceRange === 'over6000') query = query.gt('base_price', 6000)
  }

  const { data, count, error } = await query
  if (error) wrapSupabaseError('', error)

  let rooms = (data ?? []) as RoomType[]

  // Phase 27.A — hide room types that have ANY active booking in the
  // requested date range. Mirrors Phase 19's `create_booking()` RPC
  // semantics (count confirmed/checked_in overlapping the window, but
  // global — bypasses RLS via admin client). UX hint: a search result is
  // a shared inventory view; the RPC's own pool query is authoritative.
  if (filters.checkin && filters.checkout && rooms.length > 0) {
    rooms = await filterByAvailability(rooms, filters.checkin, filters.checkout)
  }

  return { rooms, total: rooms.length }
}

/**
 * Drop room types that have ANY active booking overlapping the requested
 * date range. Pool = count of active room_units per type. Booked = count
 * of bookings in {confirmed, checked_in} overlapping [checkin, checkout].
 *
 * Uses the admin client so the bookings count is globally accurate —
 * RLS policy "booking self select" would otherwise strip every other
 * user's bookings from the count, making two simultaneous searchers both
 * see the room as available while the RPC's authoritative check would
 * reject the second booking. Inventory counts are non-PII metadata.
 *
 * Phase 42 — also counts LIVE temp_pending bookings (hold_expires_at > now()).
 * Replaces the Phase 40 `booking_holds` table query. No cron needed for
 * correctness: lazy expiry flips stale temp_pending to 'expired' on every
 * read, so a query after hold expiry naturally excludes that row.
 *
 * Mirrors `create_booking()` RPC capacity check
 * (supabase/migrations/20261004_2_temp_pending_bookings.sql).
 */
async function filterByAvailability(
  rooms: RoomType[],
  checkin: string,
  checkout: string,
): Promise<RoomType[]> {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = await createAdminClient()

  // Phase 42 — count live temp_pending bookings (hold_expires_at > now()).
  // The WHERE clause excludes stale ones, so a user who closes the tab and
  // returns after the hold expires still sees the room as available.
  const [unitsRes, bookingsRes, tempRes] = await Promise.all([
    admin
      .from('room_units')
      .select('room_type_id')
      .eq('is_active', true),
    admin
      .from('bookings')
      .select('room_type_id')
      .in('status', ['confirmed', 'checked_in'])
      .lte('check_in', checkout)
      .gte('check_out', checkin),
    admin
      .from('bookings')
      .select('room_type_id')
      .eq('status', 'temp_pending')
      .gt('hold_expires_at', new Date().toISOString())
      .lte('check_in', checkout)
      .gte('check_out', checkin),
  ])

  const poolByType = new Map<string, number>()
  unitsRes.data?.forEach((u) => {
    poolByType.set(u.room_type_id, (poolByType.get(u.room_type_id) ?? 0) + 1)
  })

  const bookedByType = new Map<string, number>()
  bookingsRes.data?.forEach((b) => {
    bookedByType.set(b.room_type_id, (bookedByType.get(b.room_type_id) ?? 0) + 1)
  })

  // Phase 42 — fold LIVE temp_pending bookings into the booked count.
  tempRes.data?.forEach((b) => {
    bookedByType.set(b.room_type_id, (bookedByType.get(b.room_type_id) ?? 0) + 1)
  })

  return rooms.filter((r) => {
    const pool = poolByType.get(r.id) ?? 0
    const booked = bookedByType.get(r.id) ?? 0
    // Hide the entire room type once ANY active booking OR live temp_pending
    // overlaps the requested date range — matches the user expectation
    // "I booked it, it's gone" and matches the RPC's authoritative
    // semantics (combined `v_active_count + v_temp_count`).
    // The `pool > 0` guard still hides types with no physical units.
    return pool > 0 && booked === 0
  })
}

/**
 * Phase 32 — optional filter for the admin tabbed view at
 * `/admin/rates/room-types?tab=active|inactive|deleted`.
 *
 *   tab=active   → { isActive: true,  isDeleted: false }  (default landing)
 *   tab=inactive → { isActive: false, isDeleted: false }
 *   tab=deleted  → { isDeleted: true }                   (isActive irrelevant once deleted)
 *
 * All fields undefined = every row (admin all-rooms view, used by the
 * canonical seed / migration check + future bulk-edit screens).
 *
 * Public-facing callers (getRoomTypes, getFloors, getFeaturedRooms,
 * getRoomBySlug, searchRooms) all hard-code `isDeleted: false` to keep
 * soft-deleted rows invisible — defense-in-depth on top of the tightened
 * public RLS policy in migration `20260924_room_types_soft_delete.sql`.
 */
export interface ListRoomTypesFilter {
  isActive?: boolean | null
  isDeleted?: boolean | null
}

export async function listRoomTypes(filter?: ListRoomTypesFilter): Promise<RoomType[]> {
  const supabase = await getClient()
  let q = supabase.from('room_types').select('*').order('base_price', { ascending: true })
  if (filter?.isActive === true) q = q.eq('is_active', true)
  if (filter?.isActive === false) q = q.eq('is_active', false)
  if (filter?.isDeleted === true) q = q.not('deleted_at', 'is', null)
  if (filter?.isDeleted === false) q = q.is('deleted_at', null)
  const { data, error } = await q
  if (error) wrapSupabaseError('', error)
  return (data ?? []) as RoomType[]
}

export async function getRoomTypeById(id: string): Promise<RoomType | null> {
  const supabase = await getClient()
  const { data, error } = await supabase
    .from('room_types')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) wrapSupabaseError('', error)
  return (data as RoomType) ?? null
}

export async function createRoomType(args: Omit<RoomType, 'id'>): Promise<RoomType> {
  const supabase = await getClient()
  const { data, error } = await supabase
    .from('room_types')
    .insert({ ...args, deleted_at: args.deleted_at ?? null })
    .select()
    .single()
  if (error) wrapSupabaseError('', error)
  return data as RoomType
}

export async function updateRoomType(args: {
  id: string
  patch: Partial<Omit<RoomType, 'id'>>
}): Promise<RoomType> {
  const supabase = await getClient()
  const { data, error } = await supabase
    .from('room_types')
    .update(args.patch)
    .eq('id', args.id)
    .select()
    .single()
  if (error) wrapSupabaseError('', error)
  return data as RoomType
}

/**
 * Distinct active + non-deleted room types (`type` column) for filter dropdowns.
 * Phase 32 — added `deleted_at IS NULL` guard.
 */
export async function getRoomTypes(): Promise<RoomType['type'][]> {
  const supabase = await getClient()
  const { data, error } = await supabase
    .from('room_types')
    .select('type')
    .eq('is_active', true)
    .is('deleted_at', null)
  if (error) wrapSupabaseError('', error)
  return [...new Set((data ?? []).map((r) => r.type))]
}

/**
 * Distinct active + non-deleted floors for filter dropdowns.
 * Phase 32 — added `deleted_at IS NULL` guard.
 */
export async function getFloors(): Promise<number[]> {
  const supabase = await getClient()
  const { data, error } = await supabase
    .from('room_types')
    .select('floor')
    .eq('is_active', true)
    .is('deleted_at', null)
  if (error) wrapSupabaseError('', error)
  return [...new Set((data ?? []).map((r) => r.floor))].sort((a, b) => a - b)
}

/**
 * Catalog of amenity slugs the UI knows how to render.
 * Catalog moved here from data/mock-amenities.json when the mock layer was deleted.
 * Slug set is the canonical set used by `room_types.amenities` — add new slugs here when adding rows.
 */
const AMENITY_CATALOG: Amenity[] = [
  { slug: 'wifi', name: 'High-Speed Wi-Fi', name_th: 'Wi-Fi ความเร็วสูง', icon: 'wifi', category: 'tech' },
  { slug: 'climate_control', name: 'Climate Control', name_th: 'ปรับอากาศอัตโนมัติ', icon: 'ac_unit', category: 'comfort' },
  { slug: 'smart_tv', name: 'Smart TV', name_th: 'สมาร์ททีวี', icon: 'tv', category: 'tech' },
  { slug: 'soaking_tub', name: 'Soaking Tub', name_th: 'อ่างอาบน้ำ', icon: 'bathtub', category: 'comfort' },
  { slug: 'espresso_machine', name: 'Espresso Machine', name_th: 'เครื่องชงกาแฟ', icon: 'coffee', category: 'service' },
  { slug: 'private_balcony', name: 'Private Balcony', name_th: 'ระเบียงส่วนตัว', icon: 'deck', category: 'comfort' },
  { slug: 'room_service', name: '24/7 Room Service', name_th: 'รูมเซอร์วิส 24 ชม.', icon: 'room_service', category: 'service' },
  { slug: 'valet_laundry', name: 'Valet Laundry', name_th: 'บริการซักรีด', icon: 'dry_cleaning', category: 'service' },
]

export async function getApprovedAmenities(slugs: readonly string[]): Promise<Amenity[]> {
  const set = new Set(slugs)
  return AMENITY_CATALOG.filter((a) => set.has(a.slug))
}
