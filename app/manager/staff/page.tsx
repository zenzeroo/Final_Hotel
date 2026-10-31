import { listStaff, listShifts } from '@/lib/data/manager'
import { STAFF_PAGE_SIZE, StaffTable } from '@/components/manager/StaffTable'
import { Pagination } from '@/components/ui/Pagination'
import { ShiftSchedule } from '@/components/manager/ShiftSchedule'
import { StaffTabs } from '@/components/manager/StaffTabs'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ShiftWeekNav } from '@/components/manager/ShiftWeekNav'
import { SearchBox } from '@/components/ui/SearchBox'
import { addDaysIso, getTodayBangkok, startOfWeekMondayIso } from '@/lib/dates'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

type Tab = 'all' | 'manager' | 'reception' | 'housekeeper'

export default async function ManagerStaffPage(props: {
  searchParams: Promise<{ tab?: string; week?: string; q?: string; page?: string }>
}) {
  const searchParams = await props.searchParams
  const allowed: Tab[] = ['all', 'manager', 'reception', 'housekeeper']
  const raw = (searchParams.tab as Tab) ?? 'all'
  const tab: Tab = allowed.includes(raw) ? raw : 'all'

  // Phase 54 — ?week=YYYY-MM-DD selects the 7-day shift window (default:
  // this week in Bangkok). Validate as a real calendar date, then snap to
  // Monday so the grid always runs Mon → Sun.
  const today = getTodayBangkok()
  const currentWeekStart = startOfWeekMondayIso(today)
  const weekRaw = searchParams.week ?? ''
  const weekStart =
    /^\d{4}-\d{2}-\d{2}$/.test(weekRaw) && addDaysIso(weekRaw, 0) === weekRaw
      ? startOfWeekMondayIso(weekRaw)
      : currentWeekStart

  const locale = await getLocale()
  const t = getT(locale)
  const [staff, shiftWeek] = await Promise.all([listStaff(), listShifts(currentWeekStart)])
  // The KPI tile always counts today's shifts; the grid shows the selected week.
  const week = weekStart === currentWeekStart ? shiftWeek : await listShifts(weekStart)

  // Everything on the page — KPIs included — follows the role tab.
  const filteredStaff =
    tab === 'all' ? staff : staff.filter((s) => s.role === tab)

  const activeIds = new Set(filteredStaff.filter((s) => s.is_active).map((s) => s.id))
  const activeCount = activeIds.size
  const receptionCount = staff.filter((s) => s.role === 'reception').length
  const housekeeperCount = staff.filter((s) => s.role === 'housekeeper').length
  // Only active staff count as on shift (a stale slot of a deactivated member must not).
  const onShiftToday = shiftWeek.slots.filter(
    (slot) => slot.date === today && slot.position !== 'off' && activeIds.has(slot.staffId),
  ).length
  const tabSuffix = tab === 'all' ? '' : ` — ${t(TAB_LABEL_KEY[tab])}`

  // ?q= narrows the staff list and the shift grid by name or email. The KPIs
  // above keep counting the whole role tab.
  const query = typeof searchParams.q === 'string' ? searchParams.q.trim().slice(0, 100) : ''
  const needle = query.toLocaleLowerCase()
  const shownStaff = needle
    ? filteredStaff.filter(
        (s) => s.full_name.toLocaleLowerCase().includes(needle) || s.email.toLocaleLowerCase().includes(needle),
      )
    : filteredStaff
  const noMatch = needle !== '' && shownStaff.length === 0

  // ?page= pages the staff list only; the shift grid keeps every matching row.
  const totalPages = Math.max(1, Math.ceil(shownStaff.length / STAFF_PAGE_SIZE))
  const pageParam = Number(searchParams.page ?? 1)
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? Math.min(Math.floor(pageParam), totalPages) : 1
  const firstRow = (page - 1) * STAFF_PAGE_SIZE
  const pageStaff = shownStaff.slice(firstRow, firstRow + STAFF_PAGE_SIZE)

  return (
    <div className="p-8 lg:p-12">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">{t('manager.staffPage.pageTitle')}</h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            {t('manager.staffPage.pageSubtitle')}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 bg-surface-container-low rounded-full px-4 py-2">
          <MaterialIcon name="group" size={18} className="text-on-surface-variant" />
          <span className="text-body-md text-on-surface-variant">
            {t('manager.staffPage.headcount', { count: filteredStaff.length })}
          </span>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiTile label={t('manager.staffPage.kpiTotal')} value={filteredStaff.length} />
        <KpiTile label={t('manager.staffPage.kpiActive')} value={activeCount} />
        <KpiTile label={t('manager.staffPage.kpiOnShiftToday')} value={onShiftToday} tone="text-secondary" />
        {tab === 'all' ? (
          <KpiTile
            label={t('manager.staffPage.kpiReceptionHousekeeper')}
            value={`${receptionCount} / ${housekeeperCount}`}
          />
        ) : (
          <KpiTile label={t('manager.staffPage.kpiInactive')} value={filteredStaff.length - activeCount} />
        )}
      </section>

      <StaffTabs active={tab} locale={locale} />

      <SearchBox
        basePath="/manager/staff"
        initialQuery={query}
        placeholder={t('manager.staffPage.searchPlaceholder')}
        buttonLabel={t('manager.staffPage.search')}
        className="mb-6"
      />

      <section className="mb-12">
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
          <h2 className="font-headline-sm text-headline-sm text-primary">
            {t('manager.staffPage.staffList')}{tabSuffix}
          </h2>
          {pageStaff.length > 0 && (
            <span className="text-caption text-on-surface-variant">
              {t('manager.bookingsTable.showing', {
                from: firstRow + 1,
                to: firstRow + pageStaff.length,
                total: shownStaff.length,
              })}
            </span>
          )}
        </div>
        <StaffTable
          staff={pageStaff}
          emptyText={noMatch ? t('manager.staffPage.noMatch', { q: query }) : t('manager.staffPage.emptyGroup')}
          locale={locale}
        />
        {/* Fixed-height slot: the pager hides itself on a single page, but its
            space stays so the shift grid below never jumps. */}
        <div className="h-16">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            basePath="/manager/staff"
            extraParams={{
              tab: tab === 'all' ? undefined : tab,
              week: weekStart === currentWeekStart ? undefined : weekStart,
              q: query || undefined,
            }}
          />
        </div>
      </section>

      <section id="shifts" className="scroll-mt-8">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          {t('manager.staffPage.shiftSchedule')}{tabSuffix}
        </h2>
        {/* Phase 54 — the shift grid follows the role tab, so a manager
            scheduling housekeepers only sees housekeepers. */}
        <ShiftWeekNav
          weekStart={weekStart}
          prevWeek={addDaysIso(weekStart, -7)}
          nextWeek={addDaysIso(weekStart, 7)}
          isCurrentWeek={weekStart === currentWeekStart}
          tab={tab}
          query={query}
          staffPage={page}
        />
        {noMatch ? (
          <NoMatch text={t('manager.staffPage.noMatch', { q: query })} />
        ) : (
          <ShiftSchedule staff={shownStaff} week={week} today={today} locale={locale} />
        )}
      </section>
    </div>
  )
}

const TAB_LABEL_KEY: Record<Tab, string> = {
  all: 'manager.staffPage.tabAll',
  manager: 'manager.staffPage.tabManager',
  reception: 'manager.staffPage.tabReception',
  housekeeper: 'manager.staffPage.tabHousekeeper',
}

function NoMatch({ text }: { text: string }) {
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-8 text-center">
      <MaterialIcon name="person_search" size={40} className="text-on-surface-variant mb-2" />
      <p className="text-body-md text-on-surface-variant">{text}</p>
    </div>
  )
}

function KpiTile({ label, value, tone = 'text-primary' }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
      <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">{label}</p>
      <p className={`font-display-lg text-display-lg-mobile ${tone}`}>{value}</p>
    </div>
  )
}
