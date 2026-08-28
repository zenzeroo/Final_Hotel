import { Tabs, type TabItem } from '@/components/ui/Tabs'

type Tab = 'main' | 'refunds' | 'audit'

interface BookingsOversightTabsProps {
  active: Tab
  refundCount: number
}

const TAB_BASE: TabItem<Tab>[] = [
  { key: 'main', label: 'การจองหลัก', icon: 'bookmark', href: '/manager/bookings' },
  { key: 'refunds', label: 'คำขอคืนเงิน', icon: 'undo', href: '/manager/bookings?tab=refunds', badgeTone: 'error' },
  { key: 'audit', label: 'บันทึกการตรวจสอบ', icon: 'history', href: '/manager/bookings?tab=audit' },
]

export function BookingsOversightTabs({ active, refundCount }: BookingsOversightTabsProps) {
  const tabs: TabItem<Tab>[] = TAB_BASE.map((t) =>
    t.key === 'refunds' ? { ...t, badge: refundCount } : { ...t, badge: null },
  )
  return <Tabs active={active} tabs={tabs} />
}
