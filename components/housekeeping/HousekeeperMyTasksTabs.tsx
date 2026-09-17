/**
 * Housekeeper tasks page tabs (`/housekeeper/tasks`).
 *
 * Mirrors `components/housekeeping/HousekeeperTasksTabs.tsx` (dashboard tabs):
 * server component, URL-driven state (via parent page's searchParams),
 * hardcoded Thai labels (Tabs primitive doesn't read from t()).
 *
 * Tab 1 (default):  "งานของฉัน"              — tasks assigned to current HK
 * Tab 2:            "กลุ่มงานที่ยังไม่มีคนรับ" — unassigned pool
 *
 * The badge shows the true count. When over `DISPLAY_CAP` (5), the `<Tabs>`
 * primitive renders "5+" automatically (via the `badgeCap` prop).
 */
import { Tabs, type TabItem } from '@/components/ui/Tabs'

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
    label: 'งานของฉัน',
    icon: 'task_alt',
    href: '/housekeeper/tasks?tab=mine',
  },
  {
    key: 'unassigned',
    label: 'กลุ่มงานที่ยังไม่มีคนรับ',
    icon: 'inbox',
    href: '/housekeeper/tasks?tab=unassigned',
  },
]

export function HousekeeperMyTasksTabs({
  active,
  mineCount,
  unassignedCount,
}: HousekeeperMyTasksTabsProps) {
  const tabs: TabItem<Tab>[] = TAB_BASE.map((t) => ({
    ...t,
    badge: t.key === 'mine' ? mineCount : unassignedCount,
    badgeCap: DISPLAY_CAP,
  }))
  return <Tabs active={active} tabs={tabs} />
}