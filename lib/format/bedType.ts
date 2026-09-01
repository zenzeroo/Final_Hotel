import type { BedType } from '@/lib/data/types'

/**
 * Display label for a `BedType` enum value.
 * - `King`  → "เตียงคิงไซส์"
 * - `Queen` → "เตียงควีนไซส์"
 * - `Twin`  → "เตียงแฝด"
 *
 * Falls back to the raw enum string if a new variant is added before
 * this map is updated. Pattern parallels `lib/dates.ts`.
 */
const LABELS: Record<BedType, string> = {
  King: 'เตียงคิงไซส์',
  Queen: 'เตียงควีนไซส์',
  Twin: 'เตียงแฝด',
}

export function bedTypeLabel(bed: BedType): string {
  return LABELS[bed] ?? bed
}
