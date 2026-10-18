'use client'

import { Tabs, type TabItem } from '@/components/ui/Tabs'
import { useT } from '@/lib/i18n/useT'

type Tab = 'pending' | 'approved' | 'hidden'

interface ReviewsTabsProps {
  active: Tab
  pendingCount: number
  approvedCount: number
  hiddenCount: number
}

const TAB_BASE: Omit<TabItem<Tab>, 'badge'>[] = [
  { key: 'pending', label: 'manager.reviewsPage.pending', icon: 'pending_actions', href: '/manager/reviews?tab=pending', badgeTone: 'error' },
  { key: 'approved', label: 'manager.reviewsPage.approved', icon: 'check_circle', href: '/manager/reviews?tab=approved', badgeTone: 'primary' },
  { key: 'hidden', label: 'manager.reviewsPage.hidden', icon: 'visibility_off', href: '/manager/reviews?tab=hidden' },
]

export function ReviewsTabs({
  active,
  pendingCount,
  approvedCount,
  hiddenCount,
}: ReviewsTabsProps) {
  const t = useT()
  const counts: Record<Tab, number> = {
    pending: pendingCount,
    approved: approvedCount,
    hidden: hiddenCount,
  }
  const tabs: TabItem<Tab>[] = TAB_BASE.map((tab) => ({ ...tab, label: t(tab.label), badge: counts[tab.key] }))
  return <Tabs active={active} tabs={tabs} />
}
