import { createClient } from '@/lib/supabase/server'
import type { Booking } from './bookings'
import { wrapSupabaseError } from '@/lib/errors/supabase'

/**
 * Staff data access — queries that bypass RLS for reception/housekeeper.
 * IMPORTANT: Server-side check is required before calling these.
 */

export interface StaffBooking extends Booking {
  guest_name: string | null
  guest_email: string | null
}

export interface StaffBookingsPage {
  rows: StaffBooking[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 200

export async function getAllBookings(filters?: {
  status?: string[]
  startDate?: string
  endDate?: string
  search?: string
  /**
   * 1-indexed page number. When provided, the result is paginated
   * (`pageSize` rows per page) and `total` reflects the filtered
   * row count. When omitted, the function returns up to 200 rows
   * without a total — preserving back-compat for callers like
   * `getRecentBookings(limit)` that slice the array.
   */
  page?: number
  pageSize?: number
}): Promise<StaffBookingsPage> {
  const supabase = await createClient()

  const wantsPagination = typeof filters?.page === 'number' && filters.page >= 1
  const pageSize = Math.min(
    Math.max(filters?.pageSize ?? DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE,
  )

  const page = wantsPagination ? Math.floor(filters!.page!) : 1
  const from = wantsPagination ? (page - 1) * pageSize : 0
  const to = wantsPagination ? from + pageSize - 1 : MAX_PAGE_SIZE - 1

  // Data query — paginated range. Filters mirror the legacy getAllBookings
  // implementation; .range() replaces the old hardcoded .limit(200).
  let dataQuery = supabase
    .from('bookings')
    .select(`
      *,
      room_type:room_types(id, slug, name, name_th, hero_image_key),
      guest:profiles!bookings_user_id_fkey(full_name, phone)
    `)
    .order('check_in', { ascending: false })
    .range(from, to)
  if (filters?.status && filters.status.length > 0) {
    dataQuery = dataQuery.in('status', filters.status)
  }
  if (filters?.startDate) {
    dataQuery = dataQuery.gte('check_in', filters.startDate)
  }
  if (filters?.endDate) {
    dataQuery = dataQuery.lte('check_in', filters.endDate)
  }
  if (filters?.search) {
    dataQuery = dataQuery.or(
      `booking_code.ilike.%${filters.search}%,booker_full_name.ilike.%${filters.search}%,booker_email.ilike.%${filters.search}%`,
    )
  }

  // Count query (only when paginated) — mirrors the data query filters
  // so `total` matches the visible row count. head:true avoids fetching
  // actual rows; we only need the count header.
  let countPromise: Promise<{ count: number | null; error: unknown }> | null = null
  if (wantsPagination) {
    let q = supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
    if (filters?.status && filters.status.length > 0) {
      q = q.in('status', filters.status)
    }
    if (filters?.startDate) {
      q = q.gte('check_in', filters.startDate)
    }
    if (filters?.endDate) {
      q = q.lte('check_in', filters.endDate)
    }
    if (filters?.search) {
      q = q.or(
        `booking_code.ilike.%${filters.search}%,booker_full_name.ilike.%${filters.search}%,booker_email.ilike.%${filters.search}%`,
      )
    }
    countPromise = q as unknown as Promise<{ count: number | null; error: unknown }>
  }

  const [dataRes, countRes] = await Promise.all([
    dataQuery,
    countPromise ?? Promise.resolve({ count: null, error: null }),
  ])

  if (dataRes.error) wrapSupabaseError('getAllBookings:data', dataRes.error)
  if (countRes.error) wrapSupabaseError('getAllBookings:count', countRes.error)

  const rows = (dataRes.data ?? []) as StaffBooking[]
  const total = wantsPagination ? (countRes.count ?? 0) : 0
  const totalPages = wantsPagination && pageSize > 0 ? Math.ceil(total / pageSize) : 0

  return {
    rows,
    total,
    page: wantsPagination ? page : 1,
    pageSize: wantsPagination ? pageSize : MAX_PAGE_SIZE,
    totalPages,
  }
}

export async function getTodayStats() {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

  const [checkInsRes, checkOutsRes, inHouseRes, pendingRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('check_in', today)
      .in('status', ['confirmed', 'checked_in']),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('check_out', today)
      .in('status', ['checked_in']),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'checked_in'),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'confirmed')
      .eq('payment_status', 'unpaid'),
  ])

  return {
    todayCheckIns: checkInsRes.count ?? 0,
    todayCheckOuts: checkOutsRes.count ?? 0,
    inHouse: inHouseRes.count ?? 0,
    pendingPayment: pendingRes.count ?? 0,
  }
}

export async function getRecentBookings(limit = 5): Promise<StaffBooking[]> {
  const page = await getAllBookings({ page: 1, pageSize: limit })
  return page.rows
}

/**
 * Active rooms for /reception/rooms, each with the booking currently
 * checked in to it (if any) — a staying guest locks the room's status.
 */
export async function getRoomsStatus() {
  const supabase = await createClient()
  const [{ data, error }, { data: staying, error: stayErr }] = await Promise.all([
    supabase
      .from('room_units')
      .select(`
        id,
        floor,
        unit_label,
        view_label,
        status,
        room_type:room_types(id, slug, name, name_th, hero_image_key, base_price)
      `)
      .eq('is_active', true)
      .order('floor')
      .order('unit_label'),
    supabase
      .from('bookings')
      .select('room_unit_id, booking_code, booker_full_name')
      .eq('status', 'checked_in')
      .not('room_unit_id', 'is', null),
  ])

  if (error) wrapSupabaseError('', error)
  if (stayErr) wrapSupabaseError('', stayErr)
  const guestByUnit = new Map(
    (staying ?? []).map((b) => [b.room_unit_id as string, { code: b.booking_code as string, name: b.booker_full_name as string }]),
  )
  return (data ?? []).map((u) => ({ ...u, staying: guestByUnit.get(u.id) ?? null }))
}

export interface CustomerSummary {
  id: string
  full_name: string | null
  phone: string | null
  email: string | null
  created_at: string
}

export interface CustomerListPage {
  rows: CustomerSummary[]
  total: number
}

/**
 * List customers (role='user' only — staff profiles excluded to avoid
 * RLS-side leaks where reception would otherwise see themselves,
 * admins, managers, or other staff in the search results).
 *
 * Without `search`: returns the 20 most recent customers + total count.
 * With `search`: filters by full_name, phone OR email via case-insensitive
 * ILIKE. Requires `search.trim().length >= 2` to avoid useless
 * single-character queries hitting the DB.
 */
export async function listAllCustomers(
  opts: { search?: string } = {},
): Promise<CustomerListPage> {
  const supabase = await createClient()
  const hasSearch = !!opts.search && opts.search.trim().length >= 2
  const term = hasSearch ? `%${opts.search!.trim()}%` : null

  // Data query — role='user' filter is critical: reception session can
  // read all profiles via RLS, but we don't want staff (themselves +
  // admin/manager/housekeeper) showing up in the customer picker.
  let dataQuery = supabase
    .from('profiles')
    .select('id, full_name, phone, email, created_at')
    .eq('role', 'user')
    .order('created_at', { ascending: false })
    .limit(20)

  // Parallel count query — mirrors the data query predicates so `total`
  // matches what the user can actually see.
  let countQuery = supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'user')

  if (term) {
    dataQuery = dataQuery.or(`full_name.ilike.${term},phone.ilike.${term},email.ilike.${term}`)
    countQuery = countQuery.or(`full_name.ilike.${term},phone.ilike.${term},email.ilike.${term}`)
  }

  const [dataRes, countRes] = await Promise.all([dataQuery, countQuery])
  if (dataRes.error) wrapSupabaseError('listAllCustomers:data', dataRes.error)
  if (countRes.error) wrapSupabaseError('listAllCustomers:count', countRes.error)

  return {
    rows: (dataRes.data ?? []) as CustomerSummary[],
    total: countRes.count ?? 0,
  }
}

export async function getRecentEvents(limit = 10) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('booking_events')
    .select(`
      id,
      event_type,
      description,
      created_at,
      booking_id,
      actor:profiles!booking_events_actor_id_fkey(full_name, role)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) wrapSupabaseError('', error)
  return data ?? []
}

// Phase 46 — booking_events audit log scoped to a single booking.
// Mirrors getRecentEvents query shape (event_type + description +
// actor + created_at + metadata) but filters by booking_id.
// booking_id is nullable since Phase 36 (customer-suspension admin
// actions can write audit rows without a linked booking), so the
// `.not('booking_id','is',null)` guard is required to avoid pulling
// those orphan rows into a per-booking timeline view.
export async function getBookingEvents(bookingId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('booking_events')
    .select(`
      id,
      event_type,
      description,
      metadata,
      created_at,
      actor:profiles!booking_events_actor_id_fkey(full_name, role)
    `)
    .not('booking_id', 'is', null)
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })

  if (error) wrapSupabaseError('', error)
  return data ?? []
}
