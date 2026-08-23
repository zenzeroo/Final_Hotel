import { Tabs, type TabItem } from '@/components/ui/Tabs'

type Tab = 'pending' | 'approved' | 'hidden'

interface ReviewsTabsProps {
  active: Tab
  pendingCount: number
  approvedCount: number
  hiddenCount: number
}

const TAB_BASE: Omit<TabItem<Tab>, 'badge'>[] = [
  { key: 'pending', label: 'รออนุมัติ', icon: 'pending_actions', href: '/manager/reviews?tab=pending', badgeTone: 'error' },
  { key: 'approved', label: 'อนุมัติแล้ว', icon: 'check_circle', href: '/manager/reviews?tab=approved', badgeTone: 'primary' },
  { key: 'hidden', label: 'ซ่อนไว้', icon: 'visibility_off', href: '/manager/reviews?tab=hidden' },
]

export function ReviewsTabs({
  active,
  pendingCount,
  approvedCount,
  hiddenCount,
}: ReviewsTabsProps) {
  const counts: Record<Tab, number> = {
    pending: pendingCount,
    approved: approvedCount,
    hidden: hiddenCount,
  }
  const tabs: TabItem<Tab>[] = TAB_BASE.map((t) => ({ ...t, badge: counts[t.key] }))
  return <Tabs active={active} tabs={tabs} />
}
