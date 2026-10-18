import type { AuditLogEntry } from '@/lib/data/types'
import type { Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'

interface AuditLogTableProps {
  entries: AuditLogEntry[]
  locale: Locale
}

export function AuditLogTable({ entries, locale }: AuditLogTableProps) {
  const t = getT(locale)
  if (entries.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
        <h3 className="font-headline-sm text-headline-sm text-primary mb-2">{t('manager.bookingsPage.auditTitle')}</h3>
        <p className="text-body-md text-on-surface-variant italic">{t('manager.bookingsPage.auditEmpty')}</p>
      </div>
    )
  }
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
      <h3 className="font-headline-sm text-headline-sm text-primary mb-4">{t('manager.bookingsPage.auditTitle')}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-body-md">
          <thead className="text-label-md uppercase tracking-wider text-on-surface-variant border-b border-outline-variant">
            <tr>
              <th className="py-3 pr-4">{t('manager.bookingsPage.colTime')}</th>
              <th className="py-3 pr-4">{t('manager.bookingsPage.colStaff')}</th>
              <th className="py-3 pr-4">{t('manager.bookingsPage.colAction')}</th>
              <th className="py-3 pr-4">{t('manager.bookingsPage.colTarget')}</th>
              <th className="py-3 pr-4">{t('manager.bookingsPage.colDetails')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-outline-variant last:border-b-0">
                <td className="py-3 pr-4 text-on-surface-variant whitespace-nowrap">{e.timestamp}</td>
                <td className="py-3 pr-4 text-on-surface">
                  {e.staffName ?? 'System'}
                  {e.staffRole && (
                    <span className="text-caption text-on-surface-variant ml-1">
                      ({e.staffRole})
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-caption ${e.actionBadgeClass}`}>
                    {e.action}
                  </span>
                </td>
                <td className="py-3 pr-4 font-semibold text-primary">{e.targetCode}</td>
                <td className="py-3 pr-4 text-on-surface">{e.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
