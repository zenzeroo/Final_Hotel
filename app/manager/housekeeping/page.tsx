import Link from 'next/link'
import { getHousekeepingOverview } from '@/lib/data/manager'
import { getAllRoomUnits } from '@/lib/data/housekeeper'
import { KpiCard } from '@/components/manager/KpiCard'
import { FloorStatusGroup } from '@/components/manager/FloorStatusGroup'
import { STATUS_BG, STATUS_KEY } from '@/components/manager/RoomStatusCell'
import { FloorAssignmentCard } from '@/components/manager/FloorAssignmentCard'
import { UnassignedTaskList } from '@/components/manager/UnassignedTaskList'
import { DamageReportTable } from '@/components/manager/DamageReportTable'
import { HousekeeperCards } from '@/components/manager/HousekeeperCards'
import { CreateTaskModal } from '@/components/housekeeping/CreateTaskModal'
import { RebalanceButton } from '@/components/housekeeping/RebalanceButton'
import { PrintDailyReportButton } from '@/components/housekeeping/PrintDailyReportButton'
import { OrphanRoomsBanner } from '@/components/housekeeping/OrphanRoomsBanner'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { Tabs } from '@/components/ui/Tabs'
import { formatBangkokDate } from '@/lib/dates'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

type Tab = 'rooms' | 'tasks' | 'damage'

/**
 * The header actions, the orphan-room banner and the KPIs stay on every tab;
 * the rest is split by job (`?tab=`) so the page is not one long scroll:
 * the live room grid, the work and the team, the damage reports.
 */
export default async function ManagerHousekeepingPage(props: PageProps<'/manager/housekeeping'>) {
  const locale = await getLocale()
  const t = getT(locale)
  const rawTab = (await props.searchParams).tab
  const tab: Tab = rawTab === 'tasks' || rawTab === 'damage' ? rawTab : 'rooms'
  const [data, roomUnits] = await Promise.all([
    getHousekeepingOverview(),
    getAllRoomUnits(),
  ])

  const onShiftIds = data.housekeeperWorkloads.filter((h) => h.isAvailable).map((h) => h.housekeeperId)
  const availableHKs = onShiftIds.length
  const openDamage = data.damageReports.filter((r) => !r.resolved).length

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            {t('manager.housekeepingPage.title')}
          </h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            {t('manager.housekeepingPage.subtitle', {
              date: formatBangkokDate(new Date().toISOString(), locale === 'en' ? 'en-GB' : 'th-TH'),
            })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {/* Phase 30.1 — auto-allocation button uses `totalUnassignedCount`
                (real DB count, not the capped .limit(20) array length). */}
            <RebalanceButton
              unassignedCount={data.totalUnassignedCount}
              availableHousekeepers={availableHKs}
            />
            <CreateTaskModal roomUnits={roomUnits} housekeepers={data.housekeepers} />
            <PrintDailyReportButton />
          </div>
          {/* Phase 54 — Rebalance is disabled with nobody on shift; point the
              manager at the shift schedule instead of leaving them guessing. */}
          {availableHKs === 0 && (
            <p className="text-caption text-on-surface-variant flex items-center gap-1">
              <MaterialIcon name="event_busy" size={14} />
              {t('manager.housekeepingPage.noShiftToday')} ·{' '}
              <Link href="/manager/staff#shifts" className="text-secondary font-semibold hover:underline">
                {t('manager.housekeepingPage.goToShifts')}
              </Link>
            </p>
          )}
        </div>
      </header>

      <OrphanRoomsBanner rooms={data.orphanDirtyRooms} />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        <KpiCard label={t('manager.housekeepingPage.totalRooms')} icon="hotel">
          <p className="font-display-lg text-display-lg-mobile text-primary">{data.totalRooms}</p>
          <p className="text-caption text-on-surface-variant mt-1">
            {t('manager.housekeepingPage.occupiedN', { count: data.occupiedCount })}
          </p>
        </KpiCard>
        <KpiCard label={t('manager.housekeepingPage.kpiDirty')} icon="cleaning_services">
          <p className="font-display-lg text-display-lg-mobile text-error">{data.dirtyCount}</p>
        </KpiCard>
        <KpiCard label={t('manager.housekeepingPage.kpiOutOfService')} icon="build">
          <p className="font-display-lg text-display-lg-mobile text-secondary">
            {data.outOfServiceCount}
          </p>
        </KpiCard>
        <KpiCard label={t('manager.housekeepingPage.kpiReady')} icon="verified" tone="gold">
          <p className="font-display-lg text-display-lg-mobile text-on-secondary-container">
            {data.readyCount}
          </p>
        </KpiCard>
      </section>

      <Tabs
        active={tab}
        tabs={[
          { key: 'rooms', label: t('manager.housekeepingPage.tabRooms'), href: '/manager/housekeeping', icon: 'hotel' },
          {
            key: 'tasks',
            label: t('manager.housekeepingPage.tabTasks'),
            href: '/manager/housekeeping?tab=tasks',
            icon: 'assignment_ind',
            badge: data.totalUnassignedCount,
          },
          {
            key: 'damage',
            label: t('manager.housekeepingPage.tabDamage'),
            href: '/manager/housekeeping?tab=damage',
            icon: 'report',
            badge: openDamage,
          },
        ]}
      />

      {tab === 'rooms' && (
        <section className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6 mb-12">
          <h3 className="font-headline-sm text-headline-sm text-primary mb-3">
            {t('manager.housekeepingPage.liveRoomStatus')}
          </h3>
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-5 text-caption text-on-surface-variant">
            {(Object.keys(STATUS_BG) as (keyof typeof STATUS_BG)[]).map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <span aria-hidden className={`h-3 w-3 rounded-sm ${STATUS_BG[s]}`} />
                {t(STATUS_KEY[s])}
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-on-surface-variant" />
              {t('manager.housekeepingPage.cellHasGuest')}
            </li>
          </ul>
          <div className="flex flex-col gap-5">
            {data.floors.map((f) => (
              <FloorStatusGroup key={f.floor} group={f} locale={locale} />
            ))}
          </div>
        </section>
      )}

      {tab === 'tasks' && (
        <>
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
            <div className="lg:col-span-2">
              {/* Who covers which floor — the default for new tasks. */}
              <FloorAssignmentCard assignments={data.floorAssignments} housekeepers={data.housekeepers} />
            </div>
            <UnassignedTaskList tasks={data.unassignedTasks} housekeepers={data.housekeepers} locale={locale} />
          </section>
          <HousekeeperCards
            cards={data.assignedByHousekeeper}
            onShiftIds={onShiftIds}
            floorsByHousekeeper={Object.fromEntries(
              data.housekeeperWorkloads.map((w) => [w.housekeeperId, w.floorDefaults]),
            )}
            locale={locale}
          />
        </>
      )}

      {tab === 'damage' && (
        <section className="mb-12">
          <DamageReportTable reports={data.damageReports} locale={locale} />
        </section>
      )}
    </div>
  )
}
