/**
 * Phase 54 — shared label helpers for housekeeping dashboard components
 * (server + client safe: no hooks, no server-only imports).
 */
import { formatDistanceToNow } from 'date-fns'
import { enUS, th } from 'date-fns/locale'
import type { HousekeepingTaskType } from '@/lib/data/types'
import type { Locale } from '@/lib/i18n/config'

export const TASK_TYPE_KEY: Record<HousekeepingTaskType, string> = {
  cleaning: 'manager.housekeepingPage.typeCleaning',
  turn_down: 'manager.housekeepingPage.typeTurnDown',
  deep_clean: 'manager.housekeepingPage.typeDeepClean',
  inspection: 'manager.housekeepingPage.typeInspection',
  restock: 'manager.housekeepingPage.typeRestock',
}

/** "5 นาทีที่แล้ว" / "5 minutes ago" in the active locale. */
export function timeAgo(iso: string, locale: Locale): string {
  return formatDistanceToNow(new Date(iso), {
    addSuffix: true,
    locale: locale === 'en' ? enUS : th,
  })
}
