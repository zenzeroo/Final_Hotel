/**
 * Phase 30.2 — Housekeeper dashboard tasks tabs.
 *
 * Mirrors `components/manager/BookingsOversightTabs.tsx` + `ReviewsTabs.tsx`:
 * server component, URL-driven state (via the parent page's searchParams),
 * hardcoded Thai labels (Tabs primitive doesn't read from t()).
 *
 * Tab 1 (default):  "เร่งด่วน" — hotel-wide urgent/high priority tasks.
 * Tab 2:            "มอบหมายให้ฉัน" — tasks assigned to current HK.
 *
 * The badge shows the true count. When over `DISPLAY_CAP` (5), the `<Tabs>`
 * primitive renders "5+" automatically (via the `badgeCap` prop).
 */
import { Tabs, type TabItem } from '@/components/ui/Tabs'

type Tab = 'urgent' | 'assigned'

interface HousekeeperTasksTabsProps {
  active: Tab
  /** True count of priority tasks (urgent + high) hotel-wide. */
  urgentCount: number
  /** Count of tasks assigned to the current HK with active status. */
  assignedCount: number
}

/** Cap matching the `getMyDashboardStatsForUser` priorityTasks query limit. */
const DISPLAY_CAP = 5

const TAB_BASE: Omit<TabItem<Tab>, 'badge'>[] = [
  {
    key: 'urgent',
    label: 'เร่งด่วน',
    icon: 'priority_high',
    href: '/housekeeper?tab=urgent',
    badgeTone: 'error',
  },
  {
    key: 'assigned',
    label: 'มอบหมายให้ฉัน',
    icon: 'task_alt',
    href: '/housekeeper?tab=assigned',
  },
]

export function HousekeeperTasksTabs({
  active,
  urgentCount,
  assignedCount,
}: HousekeeperTasksTabsProps) {
  const tabs: TabItem<Tab>[] = TAB_BASE.map((t) => ({
    ...t,
    badge: t.key === 'urgent' ? urgentCount : assignedCount,
    badgeCap: DISPLAY_CAP,
  }))
  return <Tabs active={active} tabs={tabs} />
}