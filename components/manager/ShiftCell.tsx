'use client'

/**
 * Phase 54 — one editable cell of the shift schedule. Controlled `<select>`
 * that saves on change and reverts to the last saved value on error.
 */
import { useState, useTransition } from 'react'
import { setStaffShiftAction } from '@/app/actions/shifts'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useToast } from '@/components/ui/Toast'
import { useT } from '@/lib/i18n/useT'
import type { ShiftPosition } from '@/lib/data/types'
import { SHIFT_LABEL_KEY, SHIFT_STYLE } from './shiftMeta'

interface ShiftCellProps {
  staffId: string
  staffName: string
  date: string
  position: ShiftPosition | null
}

export function ShiftCell({ staffId, staffName, date, position }: ShiftCellProps) {
  const t = useT()
  const [value, setValue] = useState<ShiftPosition | ''>(position ?? '')
  const [isPending, startTransition] = useTransition()
  const toast = useToast()

  function handleChange(next: ShiftPosition | '') {
    const previous = value
    setValue(next)
    startTransition(async () => {
      const result = await setStaffShiftAction(staffId, date, next === '' ? null : next)
      if (!result.ok) {
        setValue(previous)
        toast.error(result.error)
      }
    })
  }

  const style = value ? SHIFT_STYLE[value] : null

  return (
    <>
      <label
        className={`relative inline-flex items-center gap-1 rounded-full pl-2 pr-1 py-1 text-caption ${
          style ? style.tone : 'bg-surface-container-low text-on-surface-variant'
        } ${isPending ? 'opacity-50' : ''}`}
      >
        {style ? <MaterialIcon name={style.icon} size={14} /> : null}
        <select
          value={value}
          disabled={isPending}
          onChange={(e) => handleChange(e.target.value as ShiftPosition | '')}
          aria-label={t('manager.staffPage.shiftCellLabel', { name: staffName, date })}
          className="bg-transparent text-caption focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary rounded cursor-pointer disabled:cursor-wait"
        >
          <option value="">{t('manager.staffPage.shiftNone')}</option>
          {(Object.keys(SHIFT_LABEL_KEY) as ShiftPosition[]).map((p) => (
            <option key={p} value={p}>
              {t(SHIFT_LABEL_KEY[p])}
            </option>
          ))}
        </select>
      </label>
    </>
  )
}
