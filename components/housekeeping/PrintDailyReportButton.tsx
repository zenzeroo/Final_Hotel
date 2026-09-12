'use client'

/**
 * Phase 30.1 — B8a. The "พิมพ์รายงานประจำวัน" button was rendered without
 * an onClick handler in `app/manager/housekeeping/page.tsx`. Wire it to
 * the browser's native print dialog (`window.print()`) as a quick win.
 *
 * Phase 31 candidate: replace with `/api/manager/housekeeping/daily-report`
 * route that returns a properly-formatted PDF (the current browser print
 * relies on `@media print` CSS which isn't tuned for this layout yet).
 */
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface PrintDailyReportButtonProps {
  /** Optional className override for layout slots. */
  className?: string
}

export function PrintDailyReportButton({ className }: PrintDailyReportButtonProps) {
  function handleClick() {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={
        className ??
        'inline-flex items-center gap-2 bg-primary text-secondary px-4 py-2 rounded-md text-body-md font-semibold'
      }
    >
      <MaterialIcon name="print" size={18} />
      พิมพ์รายงานประจำวัน
    </button>
  )
}
