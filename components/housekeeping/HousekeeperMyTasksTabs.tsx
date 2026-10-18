/**
 * Housekeeper tasks page tabs (`/housekeeper/tasks`).
 *
 * Mirrors `components/housekeeping/HousekeeperTasksTabs.tsx` (dashboard tabs):
 * client component (translates labels via useT), URL-driven state (via parent page's searchParams),
 * labels are dictionary keys translated here (Tabs primitive renders `label` as-is).
 *
 * Tab 1 (default):  mine        — tasks assigned to current HK
 * Tab 2:            unassigned  — unassigned pool
 *
 * The badge shows the true count. When over `DISPLAY_CAP` (5), the `<Tabs>`
 * primitive renders "5+" automatically (via the `badgeCap` prop).
 */
'use client'

import { Tabs, type TabItem } from '@/components/ui/Tabs'
import { useT } from '@/lib/i18n/useT'

type Tab = 'mine' | 'unassigned'

interface HousekeeperMyTasksTabsProps {
  active: Tab
  /** Count of tasks assigned to the current HK with active status. */
  mineCount: number
  /** Count of unassigned tasks in the hotel-wide pool. */
  unassignedCount: number
}

const DISPLAY_CAP = 5

const TAB_BASE: Omit<TabItem<Tab>, 'badge'>[] = [
  {
    key: 'mine',
    label: 'housekeeper.tasksPage.tabMine',
    icon: 'task_alt',
    href: '/housekeeper/tasks?tab=mine',
  },
  {
    key: 'unassigned',
    label: 'housekeeper.tasksPage.tabPool',
    icon: 'inbox',
    href: '/housekeeper/tasks?tab=unassigned',
  },
]

export function HousekeeperMyTasksTabs({
  active,
  mineCount,
  unassignedCount,
}: HousekeeperMyTasksTabsProps) {
  const t = useT()
  const tabs: TabItem<Tab>[] = TAB_BASE.map((tab) => ({
    ...tab,
    label: t(tab.label),
    badge: tab.key === 'mine' ? mineCount : unassignedCount,
    badgeCap: DISPLAY_CAP,
  }))
  return <Tabs active={active} tabs={tabs} />
}