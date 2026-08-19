/**
 * Data layer types — shared between mock and Supabase implementations.
 */

export type BedType = 'King' | 'Queen' | 'Twin'
export type RoomTypeName = 'Deluxe' | 'Suite' | 'Villa'

export interface RoomType {
  id: string
  slug: string
  name: string
  name_th: string
  short_desc: string
  description: string
  base_price: number // THB per night
  max_guests: number
  size_sqm: number
  bed_type: BedType
  floor: number
  view_label?: string
  rating_avg: number
  rating_count: number
  hero_image_key: string
  gallery_keys: string[]
  amenities: string[] // amenity slugs
  type: RoomTypeName
  is_active: boolean
}

export interface Amenity {
  slug: string
  name: string
  name_th: string
  icon: string // material symbol name
  category: 'comfort' | 'tech' | 'service'
}

export interface SearchFilters {
  checkin?: string // ISO date YYYY-MM-DD
  checkout?: string
  guests?: number
  type?: RoomTypeName | 'all'
  floor?: number | 'all'
  priceRange?: 'under3000' | '3000-6000' | 'over6000' | 'all'
}

export interface SearchResult {
  rooms: RoomType[]
  total: number
}
