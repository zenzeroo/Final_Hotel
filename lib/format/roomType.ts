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
