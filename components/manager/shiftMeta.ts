/**
 * Shift display metadata shared by server + client components (plain module,
 * no 'use client', so Server Components get the real values).
 *
 * Hours are display-only — `staff_shifts` stores just the position. 8h each,
 * matching the 480-minute housekeeping capacity.
 */
import type { ShiftPosition } from '@/lib/data/types'

export const SHIFT_STYLE: Record<ShiftPosition, { icon: string; tone: string }> = {
  morning: { icon: 'wb_sunny', tone: 'bg-secondary-container text-on-secondary-container' },
  afternoon: { icon: 'wb_cloudy', tone: 'bg-primary-container text-on-primary-container' },
  evening: { icon: 'nightlight', tone: 'bg-tertiary-container text-on-tertiary-container' },
  off: { icon: 'do_not_disturb_on', tone: 'bg-surface-container-high text-on-surface-variant' },
}

export const SHIFT_LABEL_KEY: Record<ShiftPosition, string> = {
  morning: 'manager.staffPage.shiftMorning',
  afternoon: 'manager.staffPage.shiftAfternoon',
  evening: 'manager.staffPage.shiftEvening',
  off: 'manager.staffPage.shiftOff',
}

export const SHIFT_HOURS: Record<Exclude<ShiftPosition, 'off'>, string> = {
  morning: '07:00–15:00',
  afternoon: '15:00–23:00',
  evening: '23:00–07:00',
}

export const WORKING_SHIFTS = Object.keys(SHIFT_HOURS) as Exclude<ShiftPosition, 'off'>[]

/** "เช้า (07:00–15:00)"; the off position has no hours. */
export function shiftLabelWithHours(t: (key: string) => string, position: ShiftPosition): string {
  const label = t(SHIFT_LABEL_KEY[position])
  return position === 'off' ? label : `${label} (${SHIFT_HOURS[position]})`
}
