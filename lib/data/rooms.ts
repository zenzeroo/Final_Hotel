import type { RoomType, SearchFilters, SearchResult } from './types'
import { isUsingMockData } from '../env'
import * as mock from './mock-rooms'
import * as supabase from './supabase-rooms'

/**
 * Public data layer — toggle between mock and Supabase based on USE_MOCK_DATA env var.
 * Default: mock (USE_MOCK_DATA !== '0').
 *
 * Set USE_MOCK_DATA=0 in .env.local to use Supabase.
 * (Supabase must be configured with NEXT_PUBLIC_SUPABASE_URL + ANON_KEY.)
 */

export async function getFeaturedRooms(): Promise<RoomType[]> {
  return isUsingMockData ? mock.getFeaturedRooms() : supabase.getFeaturedRooms()
}

export async function getRoomBySlug(slug: string): Promise<RoomType | null> {
  return isUsingMockData ? mock.getRoomBySlug(slug) : supabase.getRoomBySlug(slug)
}

export async function searchRooms(filters: SearchFilters): Promise<SearchResult> {
  return isUsingMockData ? mock.searchRooms(filters) : supabase.searchRooms(filters)
}

export async function getRoomTypes(): Promise<RoomType['type'][]> {
  return mock.getRoomTypes()
}

export async function getFloors(): Promise<number[]> {
  return mock.getFloors()
}

// Phase 7 — Admin CRUD
export async function listRoomTypes(): Promise<RoomType[]> {
  return isUsingMockData ? mock.listRoomTypes() : supabase.listRoomTypes()
}

export async function getRoomTypeById(id: string): Promise<RoomType | null> {
  return isUsingMockData ? mock.getRoomTypeById(id) : supabase.getRoomTypeById(id)
}

export async function createRoomType(args: Omit<RoomType, 'id'>): Promise<RoomType> {
  return isUsingMockData ? mock.createRoomType(args) : supabase.createRoomType(args)
}

export async function updateRoomType(args: {
  id: string
  patch: Partial<Omit<RoomType, 'id'>>
}): Promise<RoomType> {
  return isUsingMockData ? mock.updateRoomType(args) : supabase.updateRoomType(args)
}
