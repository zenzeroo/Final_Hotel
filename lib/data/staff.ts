import { createClient } from '@/lib/supabase/server'
import type { Booking } from './bookings'

/**
 * Staff data access — queries that bypass RLS for reception/housekeeper.
 * IMPORTANT: Server-side check is required before calling these.
 */

export interface StaffBooking extends Booking {
  guest_name: string | null
  guest_email: string | null
}

export async function getAllBookings(filters?: {
  status?: string[]
  startDate?: string
  endDate?: string
  search?: string
}): Promise<StaffBooking[]> {
  const supabase = await createClient()
  let query = supabase
    .from('bookings')
    .select(`
      *,
      room_type:room_types(id, slug, name, name_th, hero_image_key),
      guest:profiles!bookings_user_id_fkey(full_name, phone)
    `)
    .order('check_in', { ascending: false })
    .limit(200)

  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status)
  }
  if (filters?.startDate) {
    query = query.gte('check_in', filters.startDate)
  }
  if (filters?.endDate) {
    query = query.lte('check_in', filters.endDate)
  }
  if (filters?.search) {
    query = query.or(`booking_code.ilike.%${filters.search}%,booker_full_name.ilike.%${filters.search}%,booker_email.ilike.%${filters.search}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(`Supabase: ${error.message}`)
  return (data ?? []) as StaffBooking[]
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
  return getAllBookings().then((b) => b.slice(0, limit))
}

export async function getRoomsStatus() {
  const supabase = await createClient()
  const { data, error } = await supabase
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
    .order('unit_label')

  if (error) throw new Error(`Supabase: ${error.message}`)
  return data ?? []
}

export async function searchCustomers(q: string) {
  const supabase = await createClient()
  if (!q || q.length < 2) return []

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, created_at')
    .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
    .limit(20)

  if (error) throw new Error(`Supabase: ${error.message}`)
  return data ?? []
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

  if (error) throw new Error(`Supabase: ${error.message}`)
  return data ?? []
}
