import type { Promotion } from '@/lib/data/types'
import { formatDiscount } from '@/lib/pricing'
import { formatDateRange } from '@/lib/dates'
import { TogglePromotionButton } from './TogglePromotionButton'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { LOCALE_BCP47, type Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'

interface PromotionsTableProps {
  promotions: Promotion[]
  now: Date
  locale: Locale
}

function isExpired(p: Promotion, now: Date): boolean {
  return new Date(p.valid_until).getTime() < now.getTime()
}

function isUpcoming(p: Promotion, now: Date): boolean {
  return new Date(p.valid_from).getTime() > now.getTime()
}

export function PromotionsTable({ promotions, now, locale }: PromotionsTableProps) {
  const t = getT(locale)
  if (promotions.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-12 text-center">
        <MaterialIcon name="local_offer" size={48} className="text-on-surface-variant mb-3" />
        <p className="text-body-lg text-on-surface-variant">{t('manager.promotionsTable.empty')}</p>
      </div>
    )
  }

  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface-container-low border-b border-outline-variant">
            <tr className="text-label-md uppercase tracking-wider text-on-surface-variant">
              <th className="text-left px-4 py-3 font-medium">{t('manager.promotionsTable.colCode')}</th>
              <th className="text-left px-4 py-3 font-medium">{t('manager.promotionsTable.colName')}</th>
              <th className="text-left px-4 py-3 font-medium">{t('manager.promotionsTable.colDiscount')}</th>
              <th className="text-left px-4 py-3 font-medium">{t('manager.promotionsTable.colMinNights')}</th>
              <th className="text-left px-4 py-3 font-medium">{t('manager.promotionsTable.colPeriod')}</th>
              <th className="text-left px-4 py-3 font-medium">{t('manager.promotionsTable.colStatus')}</th>
              <th className="text-right px-4 py-3 font-medium">{t('manager.promotionsTable.colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {promotions.map((p) => {
              const expired = isExpired(p, now)
              const upcoming = isUpcoming(p, now)
              return (
                <tr key={p.id} className="hover:bg-primary-fixed transition-colors">
                  <td className="px-4 py-4">
                    <span className="font-mono text-body-md font-bold text-primary bg-secondary-container px-2 py-1 rounded">
                      {p.code}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-body-md font-medium text-primary">{p.name}</p>
                    {p.description && (
                      <p className="text-caption text-on-surface-variant mt-0.5">
                        {p.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-body-md font-semibold text-secondary">
                      {formatDiscount(p)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-body-md text-on-surface">
                    {t('manager.promotionsTable.nights', { count: p.min_nights })}
                  </td>
                  <td className="px-4 py-4 text-caption text-on-surface-variant">
                    {formatDateRange(p.valid_from, p.valid_until, LOCALE_BCP47[locale])}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1 items-start">
                      {expired && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-[10px] uppercase tracking-wider font-semibold">
                          <MaterialIcon name="schedule" size={12} />
                          {t('manager.promotionsTable.expired')}
                        </span>
                      )}
                      {upcoming && !expired && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] uppercase tracking-wider font-semibold">
                          <MaterialIcon name="event_upcoming" size={12} />
                          {t('manager.promotionsTable.upcoming')}
                        </span>
                      )}
                      {!p.is_active && !expired && !upcoming && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[10px] uppercase tracking-wider font-semibold">
                          <MaterialIcon name="pause" size={12} />
                          {t('manager.promotionsTable.inactive')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <TogglePromotionButton promotionId={p.id} isActive={p.is_active} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
