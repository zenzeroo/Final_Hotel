'use client'

/**
 * Phase 54 — week navigation (`?week=YYYY-MM-DD`) + "copy previous week"
 * for the shift schedule on /manager/staff.
 */
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { copyPreviousWeekShiftsAction } from '@/app/actions/shifts'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useToast } from '@/components/ui/Toast'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useT } from '@/lib/i18n/useT'

interface ShiftWeekNavProps {
  weekStart: string
  prevWeek: string
  nextWeek: string
  isCurrentWeek: boolean
  /** Preserves the staff-list tab when changing weeks. */
  tab: string
}

const LINK_CLASS =
  'inline-flex items-center gap-1 px-3 py-2 rounded-md text-caption text-on-surface-variant hover:bg-primary-fixed hover:text-primary transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary'

export function ShiftWeekNav({ weekStart, prevWeek, nextWeek, isCurrentWeek, tab }: ShiftWeekNavProps) {
  const t = useT()
  const [isPending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const toast = useToast()

  const href = (week?: string) => {
    const params = new URLSearchParams()
    if (tab !== 'all') params.set('tab', tab)
    if (week) params.set('week', week)
    const qs = params.toString()
    return `/manager/staff${qs ? `?${qs}` : ''}#shifts`
  }

  function handleCopy() {
    setConfirmOpen(false)
    startTransition(async () => {
      // Scope the copy to the visible role so hidden staff aren't touched.
      const result = await copyPreviousWeekShiftsAction(weekStart, tab === 'all' ? null : tab)
      if (result.ok) toast.success(t('manager.staffPage.copyPrevWeekDone', { count: result.data?.filled ?? 0 }))
      else toast.error(result.error)
    })
  }

  return (
    <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
      <nav className="flex items-center gap-1">
        <Link href={href(prevWeek)} className={LINK_CLASS} scroll={false}>
          <MaterialIcon name="chevron_left" size={18} />
          {t('manager.staffPage.prevWeek')}
        </Link>
        {!isCurrentWeek && (
          <Link href={href()} className={LINK_CLASS} scroll={false}>
            {t('manager.staffPage.thisWeek')}
          </Link>
        )}
        <Link href={href(nextWeek)} className={LINK_CLASS} scroll={false}>
          {t('manager.staffPage.nextWeek')}
          <MaterialIcon name="chevron_right" size={18} />
        </Link>
      </nav>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={isPending}
        className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-on-secondary rounded-md text-caption uppercase tracking-wider hover:bg-secondary-container hover:text-secondary transition-colors duration-200 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
      >
        <MaterialIcon name="content_copy" size={16} />
        {t('manager.staffPage.copyPrevWeek')}
      </button>

      {confirmOpen && (
        <ConfirmModal
          open
          body={t('manager.staffPage.confirmCopyPrevWeek')}
          okLabel={t('manager.staffPage.copyPrevWeek')}
          cancelLabel={t('manager.staffPage.cancel')}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleCopy}
        />
      )}
    </div>
  )
}
