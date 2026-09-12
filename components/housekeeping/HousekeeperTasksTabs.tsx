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
 * The badge shows the true count via `formatTabCount` — when there are more
 * than the display cap (5), it shows "5+" so the manager isn't misled by a
 * badge count that doesn't match the visible cards.
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

/**
 * Format a count for the tab badge — shows "5+" when over the display cap.
 * Returns `string | number` because `<Tabs>` `badge` prop is typed as
 * `number | null`; callers cast at the boundary (see `tabs` construction
 * below) to bypass the type while keeping the runtime text intact.
 */
function formatTabCount(n: number): string | number {
  return n > DISPLAY_CAP ? '5+' : n
}

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
  // `<Tabs>` `badge` is typed as `number | null`; the overflow indicator
  // ("5+") is a string but the span just renders `{badge}` as text, so the
  // cast is safe and keeps the prop API narrow.
  const tabs = TAB_BASE.map((t) => ({
    ...t,
    badge:
      t.key === 'urgent'
        ? (formatTabCount(urgentCount) as unknown as number)
        : assignedCount,
  })) as TabItem<Tab>[]
  return <Tabs active={active} tabs={tabs} />
}
