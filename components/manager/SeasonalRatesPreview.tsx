import type { SeasonalRate } from '@/lib/data/types'
import { formatTHB } from '@/lib/pricing'
import { formatDateRange } from '@/lib/dates'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { formatMultiplier, rateState, type RateState } from './ratePrice'
import { LOCALE_BCP47, type Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'

interface SeasonalRatesPreviewProps {
  rates: SeasonalRate[]
  /** Bangkok YYYY-MM-DD — decides the current/upcoming/expired badge. */
  today: string
  locale: Locale
}

function formatPricing(rate: SeasonalRate, t: (key: string, p?: Record<string, string | number>) => string): string {
  if (rate.flat_price != null) return t('manager.seasonalPreview.perNight', { price: formatTHB(rate.flat_price) })
  if (rate.price_multiplier != null) return formatMultiplier(Number(rate.price_multiplier))
  return '—'
}

// `label` is a dictionary key.
const STATE_BADGE: Record<RateState, { label: string; chip: string } | null> = {
  current: { label: 'manager.seasonalPreview.current', chip: 'bg-primary-container text-on-primary-container' },
  upcoming: null,
  expired: { label: 'manager.seasonalPreview.expired', chip: 'bg-surface-container-high text-on-surface-variant' },
  inactive: { label: 'manager.seasonalPreview.inactive', chip: 'bg-surface-container-high text-on-surface-variant' },
}

// Live rates first, then upcoming, then the ones that no longer apply.
const STATE_ORDER: Record<RateState, number> = { current: 0, upcoming: 1, expired: 2, inactive: 3 }

export function SeasonalRatesPreview({ rates, today, locale }: SeasonalRatesPreviewProps) {
  const t = getT(locale)
  if (rates.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-8 text-center">
        <MaterialIcon name="event" size={32} className="text-on-surface-variant mb-2" />
        <p className="text-body-md text-on-surface-variant">{t('manager.seasonalPreview.empty')}</p>
      </div>
    )
  }
  const rows = rates
    .map((rate) => ({ rate, state: rateState(rate, today) }))
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state])
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 overflow-hidden">
      <ul className="divide-y divide-outline-variant">
        {rows.map(({ rate, state }) => {
          const badge = STATE_BADGE[state]
          const muted = state === 'expired' || state === 'inactive'
          return (
            <li key={rate.id} className={`px-5 py-4 ${muted ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <MaterialIcon name="event" size={16} className="text-secondary" />
                    <h4 className="text-body-md font-semibold text-primary">{rate.label}</h4>
                    <span className="text-caption text-on-surface-variant">
                      · {rate.room_type_name ?? t('manager.seasonalPreview.allRooms')}
                    </span>
                    {badge && (
                      <span className={`px-2 py-0.5 rounded-full text-caption font-semibold ${badge.chip}`}>
                        {t(badge.label)}
                      </span>
                    )}
                  </div>
                  <p className="text-caption text-on-surface-variant">
                    {formatDateRange(rate.start_date, rate.end_date, LOCALE_BCP47[locale])}
                    {rate.min_nights_override != null && (
                      <span className="ml-2">{t('manager.seasonalPreview.minNights', { count: rate.min_nights_override })}</span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-display text-body-lg text-secondary">
                    {formatPricing(rate, t)}
                  </span>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
