import type { DamageReport as DamageReportType } from '@/lib/data/types'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ResolveDamageButton } from './ResolveDamageButton'
import { formatTHB } from '@/lib/pricing'
import { formatBangkokDate } from '@/lib/dates'
import type { Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'

interface DamageReportTableProps {
  reports: DamageReportType[]
  locale: Locale
}

const SEVERITY_KEY: Record<DamageReportType['severity'], string> = {
  normal: 'manager.housekeepingPage.damageSeverityNormal',
  urgent: 'manager.housekeepingPage.damageSeverityUrgent',
}

const SEVERITY_CLASS: Record<DamageReportType['severity'], string> = {
  normal: 'bg-surface-variant text-on-surface-variant',
  urgent: 'bg-error-container text-on-error-container',
}

export function DamageReportTable({ reports, locale }: DamageReportTableProps) {
  const t = getT(locale)
  if (reports.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
        <h3 className="font-headline-sm text-headline-sm text-primary mb-2">{t('manager.housekeepingPage.damageReports')}</h3>
        <p className="text-body-md text-on-surface-variant italic">{t('manager.housekeepingPage.noDamageReports')}</p>
      </div>
    )
  }
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
      <h3 className="font-headline-sm text-headline-sm text-primary mb-4">{t('manager.housekeepingPage.damageReports')}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-body-md">
          <thead className="text-label-md uppercase tracking-wider text-on-surface-variant border-b border-outline-variant">
            <tr>
              <th className="py-3 pr-4">{t('manager.housekeepingPage.damageColRoom')}</th>
              <th className="py-3 pr-4">{t('manager.housekeepingPage.damageColReporter')}</th>
              <th className="py-3 pr-4">{t('manager.housekeepingPage.damageColDescription')}</th>
              <th className="py-3 pr-4">{t('manager.housekeepingPage.damageColPhoto')}</th>
              <th className="py-3 pr-4">{t('manager.housekeepingPage.damageColSeverity')}</th>
              <th className="py-3 pr-4">{t('manager.housekeepingPage.damageColCost')}</th>
              <th className="py-3 pr-4">{t('manager.housekeepingPage.damageColAction')}</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="border-b border-outline-variant last:border-b-0">
                <td className="py-3 pr-4 font-semibold text-primary">{r.roomNumber}</td>
                <td className="py-3 pr-4 text-on-surface-variant">{r.reportedBy}</td>
                <td className="py-3 pr-4 text-on-surface max-w-xs">{r.description}</td>
                <td className="py-3 pr-4">
                  {r.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.photoUrl}
                      alt={t('manager.housekeepingPage.damagePhotoAlt', { room: r.roomNumber })}
                      className="w-12 h-12 object-cover rounded-md"
                    />
                  ) : (
                    <span className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-surface-variant text-on-surface-variant">
                      <MaterialIcon name="image" size={20} />
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-caption ${SEVERITY_CLASS[r.severity]}`}
                  >
                    {t(SEVERITY_KEY[r.severity])}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  {r.costEstimate != null ? (
                    formatTHB(r.costEstimate)
                  ) : (
                    <span className="text-on-surface-variant italic">—</span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  {r.resolved ? (
                    <span className="text-caption text-on-surface-variant">
                      {t('manager.housekeepingPage.damageResolvedOn', {
                        date: r.resolvedAt ? formatBangkokDate(r.resolvedAt, locale === 'en' ? 'en-GB' : 'th-TH') : '',
                      })}
                    </span>
                  ) : (
                    <ResolveDamageButton reportId={r.id} defaultCost={r.costEstimate} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
