/**
 * Phase 30.2 — Housekeeper dashboard tasks tabs.
 *
 * Mirrors `components/manager/BookingsOversightTabs.tsx` + `ReviewsTabs.tsx`:
 * client component (translates labels via useT), URL-driven state (via the parent page's searchParams),
 * labels are dictionary keys translated here (Tabs primitive renders `label` as-is).
 *
 * Tab 1 (default):  urgent   — hotel-wide urgent/high priority tasks.
 * Tab 2:            assigned — tasks assigned to current HK.
 *
 * The badge shows the true count. When over `DISPLAY_CAP` (5), the `<Tabs>`
 * primitive renders "5+" automatically (via the `badgeCap` prop).
 */
'use client'

import { Tabs, type TabItem } from '@/components/ui/Tabs'
import { useT } from '@/lib/i18n/useT'

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
    label: 'housekeeper.dashboardTabs.urgent',
    icon: 'priority_high',
    href: '/housekeeper?tab=urgent',
    badgeTone: 'error',
  },
  {
    key: 'assigned',
    label: 'housekeeper.dashboardTabs.assigned',
    icon: 'task_alt',
    href: '/housekeeper?tab=assigned',
  },
]

export function HousekeeperTasksTabs({
  active,
  urgentCount,
  assignedCount,
}: HousekeeperTasksTabsProps) {
  const t = useT()
  const tabs: TabItem<Tab>[] = TAB_BASE.map((tab) => ({
    ...tab,
    label: t(tab.label),
    badge: tab.key === 'urgent' ? urgentCount : assignedCount,
    badgeCap: DISPLAY_CAP,
  }))
  return <Tabs active={active} tabs={tabs} />
}