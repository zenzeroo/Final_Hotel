import { Tabs, type TabItem } from '@/components/ui/Tabs'
import type { Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'

type Tab = 'all' | 'manager' | 'reception' | 'housekeeper'

const TAB_DEFS: { key: Tab; labelKey: string; icon: string; href: string }[] = [
  { key: 'all', labelKey: 'manager.staffPage.tabAll', icon: 'group', href: '/manager/staff' },
  { key: 'manager', labelKey: 'manager.staffPage.tabManager', icon: 'admin_panel_settings', href: '/manager/staff?tab=manager' },
  { key: 'reception', labelKey: 'manager.staffPage.tabReception', icon: 'support_agent', href: '/manager/staff?tab=reception' },
  { key: 'housekeeper', labelKey: 'manager.staffPage.tabHousekeeper', icon: 'cleaning_services', href: '/manager/staff?tab=housekeeper' },
]

export function StaffTabs({ active, locale }: { active: Tab; locale: Locale }) {
  const t = getT(locale)
  const tabs: TabItem<Tab>[] = TAB_DEFS.map(({ labelKey, ...rest }) => ({ ...rest, label: t(labelKey) }))
  return <Tabs active={active} tabs={tabs} />
}
