import type { RoomTypeName } from '@/lib/data/types'

/**
 * Display label for a `RoomTypeName` enum value.
 * - `Deluxe` → "ดีลักซ์" / "Deluxe"
 * - `Suite`  → "สวีท"   / "Suite"
 * - `Villa`  → "วิลล่า"  / "Villa"
 *
 * Falls back to the raw enum string if a new variant is added before
 * this map is updated. Pattern parallels `lib/format/bedType.ts`.
 */
const TH_LABELS: Record<RoomTypeName, string> = {
  Deluxe: 'ดีลักซ์',
  Suite: 'สวีท',
  Villa: 'วิลล่า',
}

const EN_LABELS: Record<RoomTypeName, string> = {
  Deluxe: 'Deluxe',
  Suite: 'Suite',
  Villa: 'Villa',
}

export function roomTypeLabel(type: RoomTypeName, locale: 'th' | 'en' = 'th'): string {
  const map = locale === 'en' ? EN_LABELS : TH_LABELS
  return map[type] ?? type
}

/**
 * Display name for a row that carries both `name` (English) and `name_th`
 * (room types, amenities). Thai view prefers `name_th`; English view always
 * uses `name` — showing `name_th` regardless leaked Thai into the EN UI.
 */
export function localizedName(
  row: { name?: string | null; name_th?: string | null } | null | undefined,
  locale: 'th' | 'en',
): string {
  if (!row) return ''
  if (locale === 'th') return row.name_th || row.name || ''
  return row.name || row.name_th || ''
}
