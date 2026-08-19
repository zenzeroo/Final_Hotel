import type { RoomType, SearchFilters, SearchResult } from './types'
import roomsJson from '../../data/mock-rooms.json'

const rooms: RoomType[] = roomsJson as RoomType[]

export async function getFeaturedRooms(): Promise<RoomType[]> {
  return rooms
    .filter((r) => r.is_active)
    .sort((a, b) => b.rating_avg - a.rating_avg)
    .slice(0, 4)
}

export async function getRoomBySlug(slug: string): Promise<RoomType | null> {
  return rooms.find((r) => r.slug === slug && r.is_active) ?? null
}

export async function searchRooms(filters: SearchFilters): Promise<SearchResult> {
  let filtered = rooms.filter((r) => r.is_active)

  if (filters.type && filters.type !== 'all') {
    filtered = filtered.filter((r) => r.type === filters.type)
  }

  if (filters.floor !== undefined && filters.floor !== 'all') {
    filtered = filtered.filter((r) => r.floor === filters.floor)
  }

  if (filters.guests && filters.guests > 0) {
    filtered = filtered.filter((r) => r.max_guests >= filters.guests!)
  }

  if (filters.priceRange && filters.priceRange !== 'all') {
    filtered = filtered.filter((r) => {
      if (filters.priceRange === 'under3000') return r.base_price < 3000
      if (filters.priceRange === '3000-6000')
        return r.base_price >= 3000 && r.base_price <= 6000
      if (filters.priceRange === 'over6000') return r.base_price > 6000
      return true
    })
  }

  return { rooms: filtered, total: filtered.length }
}

export async function getRoomTypes(): Promise<RoomType['type'][]> {
  return ['Deluxe', 'Suite', 'Villa']
}

export async function getFloors(): Promise<number[]> {
  return [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b)
}
