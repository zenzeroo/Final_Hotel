import type { RoomTypeName } from '@/lib/data/types'

/**
 * `/rooms?type=` holds the selected room types as a comma-separated list
 * (`type=Suite,Villa`). Unknown values are dropped so a hand-edited URL
 * never reaches the `room_type_enum` column (Postgres would reject it).
 */
const ROOM_TYPE_NAMES = ['Deluxe', 'Suite', 'Villa'] as const satisfies readonly RoomTypeName[]

export function parseRoomTypesParam(
  raw: string | string[] | null | undefined,
): RoomTypeName[] {
  const values = (Array.isArray(raw) ? raw : [raw ?? ''])
    .flatMap((v) => v.split(','))
  return ROOM_TYPE_NAMES.filter((name) => values.includes(name))
}

export function formatRoomTypesParam(types: readonly RoomTypeName[]): string {
  return types.join(',')
}
