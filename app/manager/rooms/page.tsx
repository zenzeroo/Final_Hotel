import { listRoomUnits, listSeasonalRates } from '@/lib/data/manager'
import { RoomInventoryTable } from '@/components/manager/RoomInventoryTable'
import { SeasonalRatesPreview } from '@/components/manager/SeasonalRatesPreview'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { roomBucket } from '@/components/manager/roomStatusBuckets'
import { getTodayBangkok } from '@/lib/dates'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

export default async function ManagerRoomsPage() {
  const locale = await getLocale()
  const t = getT(locale)
  const [units, seasonalRates] = await Promise.all([
    listRoomUnits(),
    listSeasonalRates(),
  ])

  const today = getTodayBangkok()
  // Every one of the 9 statuses lands in exactly one card, so the cards sum to units.length.
  const count = { available: 0, occupied: 0, cleaning: 0, closed: 0 }
  for (const u of units) count[roomBucket(u.status)]++
  const { available, occupied, cleaning, closed } = count

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            {t('manager.ratesPage.heading')}
          </h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            {t('manager.ratesPage.subtitle')}
          </p>
        </div>
      </header>

      {/* Admin-only banner */}
      <section className="mb-8 bg-secondary-container rounded-lg p-4 flex items-start gap-3">
        <MaterialIcon name="info" size={20} className="text-on-secondary-container shrink-0 mt-0.5" />
        <div>
          <p className="text-body-md text-on-secondary-container font-medium">
            {t('manager.ratesPage.adminOnlyTitle')}
          </p>
          <p className="text-caption text-on-secondary-container mt-0.5 opacity-80">
            {t('manager.ratesPage.adminOnlyBody')}
          </p>
        </div>
      </section>

      {/* 4-col KPI */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-label-md uppercase tracking-wider text-on-surface-variant">
              {t('manager.ratesPage.kpiAvailable')}
            </p>
            <MaterialIcon name="check_circle" size={18} className="text-primary" />
          </div>
          <p className="font-display-lg text-display-lg-mobile text-primary">{available}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-label-md uppercase tracking-wider text-on-surface-variant">
              {t('manager.ratesPage.kpiOccupied')}
            </p>
            <MaterialIcon name="person" size={18} className="text-tertiary" />
          </div>
          <p className="font-display-lg text-display-lg-mobile text-tertiary">{occupied}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-label-md uppercase tracking-wider text-on-surface-variant">
              {t('manager.ratesPage.kpiCleaning')}
            </p>
            <MaterialIcon name="cleaning_services" size={18} className="text-secondary" />
          </div>
          <p className="font-display-lg text-display-lg-mobile text-secondary">{cleaning}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-label-md uppercase tracking-wider text-on-surface-variant">
              {t('manager.ratesPage.kpiClosed')}
            </p>
            <MaterialIcon name="build" size={18} className="text-error" />
          </div>
          <p className="font-display-lg text-display-lg-mobile text-error">{closed}</p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          {t('manager.ratesPage.roomStatusHeading', { count: units.length })}
        </h2>
        <RoomInventoryTable units={units} rates={seasonalRates} today={today} locale={locale} />
      </section>

      <section className="mb-8">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          {t('manager.ratesPage.seasonalHeading')}
        </h2>
        <SeasonalRatesPreview rates={seasonalRates} today={today} locale={locale} />
      </section>
    </div>
  )
}
