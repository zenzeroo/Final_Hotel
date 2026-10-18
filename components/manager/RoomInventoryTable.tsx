import type { RoomUnitWithType, RoomUnitStatus, SeasonalRate } from '@/lib/data/types'
import { formatTHB } from '@/lib/pricing'
import { CloseRoomButton } from './CloseRoomButton'
import { todayPrice } from './ratePrice'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { EmptyState } from '@/components/feedback/EmptyState'
import type { Locale } from '@/lib/i18n/config'
import { ROOM_STATUS_KEY } from './roomStatusBuckets'
import { getT } from '@/lib/i18n/t'

interface RoomInventoryTableProps {
  units: RoomUnitWithType[]
  /** Seasonal rates — the price column shows tonight's price, not base_price. */
  rates: SeasonalRate[]
  /** Bangkok YYYY-MM-DD */
  today: string
  locale: Locale
}

// Labels: ROOM_STATUS_KEY (staff.status.*).
const STATUS_LABEL: Record<RoomUnitStatus, { icon: string; chip: string; dot: string }> = {
  available: {
    icon: 'check_circle',
    chip: 'bg-primary-container text-on-primary-container',
    dot: 'bg-primary',
  },
  occupied: {
    icon: 'person',
    chip: 'bg-tertiary-container text-on-tertiary-container',
    dot: 'bg-tertiary',
  },
  cleaning: {
    icon: 'cleaning_services',
    chip: 'bg-secondary-container text-on-secondary-container',
    dot: 'bg-secondary',
  },
  maintenance: {
    icon: 'build',
    chip: 'bg-error-container text-on-error-container',
    dot: 'bg-error',
  },
  out_of_order: {
    icon: 'block',
    chip: 'bg-surface-container-high text-on-surface-variant',
    dot: 'bg-on-surface-variant',
  },
  // Phase 30.1 — DB CHECK widened to include these 4 new values.
  waiting_cleaning: {
    icon: 'hourglass_empty',
    chip: 'bg-error-container text-on-error-container',
    dot: 'bg-error',
  },
  inspection: {
    icon: 'visibility',
    chip: 'bg-secondary-container text-on-secondary-container',
    dot: 'bg-secondary',
  },
  ready: {
    icon: 'verified',
    chip: 'bg-primary-container text-on-primary-container',
    dot: 'bg-primary',
  },
  checkout: {
    icon: 'logout',
    chip: 'bg-error-container text-on-error-container',
    dot: 'bg-error',
  },
}

export function RoomInventoryTable({ units, rates, today, locale }: RoomInventoryTableProps) {
  const t = getT(locale)
  // Empty branch — guard against silent blank space on no-room-units DB.
  if (units.length === 0) {
    return (
      <EmptyState
        icon="hotel"
        title={t('manager.roomsTable.empty')}
        description={t('manager.roomsTable.emptyBody')}
      />
    )
  }

  // Group by floor
  const floors = Array.from(new Set(units.map((u) => u.floor))).sort((a, b) => a - b)
  const grouped = floors.map((floor) => ({
    floor,
    units: units.filter((u) => u.floor === floor),
  }))

  return (
    <div className="space-y-6">
      {grouped.map(({ floor, units: floorUnits }) => (
        <section key={floor}>
          <h3 className="font-headline-xs text-headline-xs text-primary mb-3">
            {t('manager.roomsTable.floorN', { floor })}{' '}
            <span className="text-caption text-on-surface-variant ml-2">
              {t('manager.roomsTable.roomsCount', { count: floorUnits.length })}
            </span>
          </h3>
          <div className="bg-surface-container-lowest rounded-lg shadow-level-1 overflow-x-auto overflow-y-hidden">
            <table className="w-full">
              <thead className="bg-surface-container-low border-b border-outline-variant">
                <tr className="text-label-md uppercase tracking-wider text-on-surface-variant">
                  <th className="text-left px-4 py-3 font-medium">{t('manager.roomsTable.colRoom')}</th>
                  <th className="text-left px-4 py-3 font-medium">{t('manager.roomsTable.colType')}</th>
                  <th className="text-left px-4 py-3 font-medium">{t('manager.roomsTable.colView')}</th>
                  <th className="text-right px-4 py-3 font-medium">{t('manager.roomsTable.colTonight')}</th>
                  <th className="text-left px-4 py-3 font-medium">{t('manager.roomsTable.colStatus')}</th>
                  <th className="text-right px-4 py-3 font-medium">{t('manager.roomsTable.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {floorUnits.map((unit) => {
                  const status = STATUS_LABEL[unit.status]
                  const base = Number(unit.room_type.base_price)
                  const tonight = todayPrice(base, rates, unit.room_type.id, today)
                  return (
                    <tr key={unit.id} className="hover:bg-primary-fixed transition-colors">
                      <td className="px-4 py-4">
                        <span className="font-mono text-body-md font-bold text-primary">
                          {unit.unit_label}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-body-md font-medium text-primary">
                          {unit.room_type.name}
                        </p>
                        {unit.room_type.name_th && (
                          <p className="text-caption text-on-surface-variant">
                            {unit.room_type.name_th}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-body-md text-on-surface-variant">
                        {unit.view_label ?? '—'}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-body-md font-semibold text-primary">
                          {formatTHB(tonight.price)}
                        </span>
                        {tonight.price !== base && (
                          <>
                            <span className="block text-caption text-on-surface-variant line-through">
                              {formatTHB(base)}
                            </span>
                            <span className="block text-caption text-secondary">{tonight.label}</span>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption font-semibold ${status.chip}`}
                        >
                          <MaterialIcon name={status.icon} size={12} />
                          {t(ROOM_STATUS_KEY[unit.status])}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <CloseRoomButton unitId={unit.id} status={unit.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}
