import { FilterSidebar } from './FilterSidebar'
import { getRoomTypes, getFloors } from '@/lib/data/rooms'

/**
 * Server wrapper that fetches room types + floors from the real DB
 * (DISTINCT `type`/`floor` from `room_types` where `is_active = true`)
 * and passes them down to the client-side `FilterSidebar` component.
 *
 * Replaces the previous hardcoded `ROOM_TYPES = ['Deluxe','Suite','Villa']`
 * and `FLOORS = [1,2,3,4]` constants in FilterSidebar.tsx.
 */
export async function FilterSidebarServer() {
  const [roomTypes, floors] = await Promise.all([getRoomTypes(), getFloors()])
  return <FilterSidebar roomTypes={roomTypes} floors={floors} />
}