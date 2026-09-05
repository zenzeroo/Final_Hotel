import type { BedType } from '@/lib/data/types'

/**
 * Display label for a `BedType` enum value.
 * - `King`  → "King bed" / "เตียงคิงไซส์"
 * - `Queen` → "Queen bed" / "เตียงควีนไซส์"
 * - `Twin`  → "Twin beds" / "เตียงแฝด"
 *
 * Falls back to the raw enum string if a new variant is added before
 * this map is updated. Pattern parallels `lib/dates.ts`.
 */
const TH_LABELS: Record<BedType, string> = {
  King: 'เตียงคิงไซส์',
  Queen: 'เตียงควีนไซส์',
  Twin: 'เตียงแฝด',
}

const EN_LABELS: Record<BedType, string> = {
  King: 'King bed',
  Queen: 'Queen bed',
  Twin: 'Twin beds',
}

export function bedTypeLabel(bed: BedType, locale: 'th' | 'en' = 'th'): string {
  const map = locale === 'en' ? EN_LABELS : TH_LABELS
  return map[bed] ?? bed
}
