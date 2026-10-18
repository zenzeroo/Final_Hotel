'use client'

import { Tabs, type TabItem } from '@/components/ui/Tabs'
import { useT } from '@/lib/i18n/useT'

type Tab = 'main' | 'refunds' | 'audit'

interface BookingsOversightTabsProps {
  active: Tab
  refundCount: number
}

const TAB_BASE: TabItem<Tab>[] = [
  { key: 'main', label: 'manager.bookingsPage.tabMain', icon: 'bookmark', href: '/manager/bookings' },
  { key: 'refunds', label: 'manager.bookingsPage.tabRefunds', icon: 'undo', href: '/manager/bookings?tab=refunds', badgeTone: 'error' },
  { key: 'audit', label: 'manager.bookingsPage.tabAudit', icon: 'history', href: '/manager/bookings?tab=audit' },
]

export function BookingsOversightTabs({ active, refundCount }: BookingsOversightTabsProps) {
  const t = useT()
  const tabs: TabItem<Tab>[] = TAB_BASE.map((tab) =>
    tab.key === 'refunds'
      ? { ...tab, label: t(tab.label), badge: refundCount }
      : { ...tab, label: t(tab.label), badge: null },
  )
  return <Tabs active={active} tabs={tabs} />
}
