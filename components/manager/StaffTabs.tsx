import { Tabs, type TabItem } from '@/components/ui/Tabs'

type Tab = 'all' | 'manager' | 'reception' | 'housekeeper'

const TABS: TabItem<Tab>[] = [
  { key: 'all', label: 'ทั้งหมด', icon: 'group', href: '/manager/staff' },
  { key: 'manager', label: 'ผู้จัดการ', icon: 'admin_panel_settings', href: '/manager/staff?tab=manager' },
  { key: 'reception', label: 'ต้อนรับ', icon: 'support_agent', href: '/manager/staff?tab=reception' },
  { key: 'housekeeper', label: 'แม่บ้าน', icon: 'cleaning_services', href: '/manager/staff?tab=housekeeper' },
]

export function StaffTabs({ active }: { active: Tab }) {
  return <Tabs active={active} tabs={TABS} />
}
