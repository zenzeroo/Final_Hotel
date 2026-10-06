import Link from 'next/link'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface PaginationProps {
  currentPage: number
  totalPages: number
  /** URL path without query string, e.g. "/reception/bookings". */
  basePath: string
  /** Other query params to preserve across page changes. Undefined / empty values are stripped. */
  extraParams?: Record<string, string | undefined | null>
}

/**
 * Numbered pagination control — server component (uses `<Link>` so the
 * browser back button navigates between pages). Hides itself when
 * `totalPages <= 1`. Shows a sliding window of page numbers when there
 * are many pages (1 … 4 5 6 … N).
 */
export function Pagination({
  currentPage,
  totalPages,
  basePath,
  extraParams,
}: PaginationProps) {
  if (totalPages <= 1) return null

  const buildHref = (page: number): string => {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(extraParams ?? {})) {
      if (v != null && v !== '') params.set(k, String(v))
    }
    if (page > 1) params.set('page', String(page))
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  const pages = pageWindow(currentPage, totalPages)
  const hasPrev = currentPage > 1
  const hasNext = currentPage < totalPages

  const linkClass =
    'inline-flex items-center justify-center min-w-9 h-9 px-3 rounded-lg border border-outline-variant text-body-md text-on-surface hover:bg-primary-fixed hover:border-secondary transition-colors'
  const activeClass =
    'inline-flex items-center justify-center min-w-9 h-9 px-3 rounded-lg border border-primary bg-primary text-on-primary text-body-md font-semibold'
  const disabledClass =
    'inline-flex items-center justify-center min-w-9 h-9 px-3 rounded-lg border border-outline-variant text-caption text-on-surface-variant opacity-40 cursor-not-allowed'

  return (
    <nav
      aria-label="Pagination"
      className="mt-6 flex items-center justify-center gap-2 flex-wrap"
    >
      {hasPrev ? (
        <Link
          href={buildHref(currentPage - 1)}
          rel="prev"
          className={linkClass}
          aria-label="ก่อนหน้า"
        >
          <MaterialIcon name="chevron_left" size={18} />
          <span className="ml-1">ก่อนหน้า</span>
        </Link>
      ) : (
        <span className={disabledClass} aria-disabled="true">
          <MaterialIcon name="chevron_left" size={18} />
          <span className="ml-1">ก่อนหน้า</span>
        </span>
      )}

      {pages.map((p, i) =>
        p === '…' ? (
          <span
            key={`ellipsis-${i}`}
            className="inline-flex items-center justify-center min-w-9 h-9 px-2 text-on-surface-variant"
            aria-hidden="true"
          >
            …
          </span>
        ) : p === currentPage ? (
          <span key={p} className={activeClass} aria-current="page">
            {p}
          </span>
        ) : (
          <Link key={p} href={buildHref(p)} className={linkClass}>
            {p}
          </Link>
        ),
      )}

      {hasNext ? (
        <Link
          href={buildHref(currentPage + 1)}
          rel="next"
          className={linkClass}
          aria-label="ถัดไป"
        >
          <span className="mr-1">ถัดไป</span>
          <MaterialIcon name="chevron_right" size={18} />
        </Link>
      ) : (
        <span className={disabledClass} aria-disabled="true">
          <span className="mr-1">ถัดไป</span>
          <MaterialIcon name="chevron_right" size={18} />
        </span>
      )}
    </nav>
  )
}

/**
 * Build a sliding window of page numbers to render. Always includes 1
 * and totalPages; current sits in the middle. Returns `'…'` markers
 * to fill gaps between the visible pages.
 */
function pageWindow(current: number, total: number): (number | '…')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages: (number | '…')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) pages.push('…')
  for (let p = start; p <= end; p++) pages.push(p)
  if (end < total - 1) pages.push('…')
  pages.push(total)
  return pages
}