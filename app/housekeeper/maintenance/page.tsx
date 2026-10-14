import { getMaintenanceReports } from '@/lib/data/housekeeper'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

/**
 * Phase 53b — simplified maintenance page. Two sections (pending vs
 * fixed) each rendering a plain list of report titles. The previous
 * filter-tab nav, the "แจ้งปัญหา" button, and the rich
 * MaintenanceReportCard are removed from THIS page only. The
 * MaintenanceReportCard / MaintenanceReportModal components stay
 * because the housekeeper dashboard + reception + manager pages
 * still import them.
 */
export default async function MaintenanceReportsPage() {
  const locale = await getLocale()
  const t = getT(locale)

  // Fetch all reports (no filter); split into two sections client-side.
  const reports = await getMaintenanceReports()
  const fixed = reports
    .filter((r) => r.status === 'resolved')
    .sort((a, b) => (b.resolved_at ?? '').localeCompare(a.resolved_at ?? ''))
  const pending = reports
    .filter((r) => r.status === 'open' || r.status === 'in_progress')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8">
        <h1 className="font-headline-md text-headline-md text-primary mb-2">
          {t('housekeeper.maintenancePage.title')}
        </h1>
        <p className="text-body-lg text-on-surface-variant">
          {t('housekeeper.maintenancePage.subtitle')}
        </p>
      </header>

      <section className="mb-12">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          {t('housekeeper.maintenancePage.sectionOpen')}
        </h2>
        {pending.length === 0 ? (
          <p className="text-body-md text-on-surface-variant italic">—</p>
        ) : (
          <ul className="space-y-2">
            {pending.map((r) => (
              <li
                key={r.id}
                className="font-body-md text-on-surface border-b border-outline-variant/30 pb-2 last:border-0"
              >
                {r.title}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          {t('housekeeper.maintenancePage.sectionFixed')}
        </h2>
        {fixed.length === 0 ? (
          <p className="text-body-md text-on-surface-variant italic">—</p>
        ) : (
          <ul className="space-y-2">
            {fixed.map((r) => (
              <li
                key={r.id}
                className="font-body-md text-on-surface border-b border-outline-variant/30 pb-2 last:border-0"
              >
                {r.title}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
