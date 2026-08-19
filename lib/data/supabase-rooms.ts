import { createClient } from '@supabase/supabase-js'
import type { RoomType, SearchFilters, SearchResult } from './types'
import { env, hasSupabase } from '../env'

/**
 * Supabase implementation — used when USE_MOCK_DATA=0.
 * Tables expected: room_types.
 */
function getClient() {
  if (!hasSupabase) {
    throw new Error('Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function getFeaturedRooms(): Promise<RoomType[]> {
  const supabase = getClient()
  const { data, error } = await supabase
    .from('room_types')
    .select('*')
    .eq('is_active', true)
    .order('rating_avg', { ascending: false })
    .limit(4)

  if (error) throw new Error(`Supabase: ${error.message}`)
  return (data ?? []) as RoomType[]
}

export async function getRoomBySlug(slug: string): Promise<RoomType | null> {
  const supabase = getClient()
  const { data, error } = await supabase
    .from('room_types')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw new Error(`Supabase: ${error.message}`)
  return (data as RoomType) ?? null
}

export async function searchRooms(filters: SearchFilters): Promise<SearchResult> {
  const supabase = getClient()
  let query = supabase
    .from('room_types')
    .select('*', { count: 'exact' })
    .eq('is_active', true)

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
  if (error) throw new Error(`Supabase: ${error.message}`)

  return { rooms: (data ?? []) as RoomType[], total: count ?? 0 }
}
