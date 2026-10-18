import { getRoomTypes, listRoomTypes } from '@/lib/data/rooms'
import { PromotionForm } from '@/components/admin/PromotionForm'
import { SeasonalRateForm } from '@/components/admin/SeasonalRateForm'
import { Tabs } from '@/components/ui/Tabs'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import Link from 'next/link'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

const NEW_TABS = [
  { key: 'code', label: 'admin.promotions.tabCode', href: '/admin/promotions/new?tab=code', icon: 'sell' },
  { key: 'dates', label: 'admin.promotions.tabDates', href: '/admin/promotions/new?tab=dates', icon: 'event' },
] as const
type NewTabKey = (typeof NEW_TABS)[number]['key']

export default async function NewPromotionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const t = getT(await getLocale())
  const [{ tab: rawTab }, roomTypes, roomTypeNames] = await Promise.all([
    searchParams,
    listRoomTypes({ isDeleted: false }),
    getRoomTypes(),
  ])
  const tab: NewTabKey = rawTab === 'dates' ? 'dates' : 'code'

  return (
    <div className="p-8 lg:p-12 max-w-3xl">
      <Link
        href="/admin/promotions"
        className="inline-flex items-center gap-2 px-2 py-1 rounded text-body-md text-primary hover:bg-primary-fixed hover:text-primary mb-4 transition-colors duration-200"
      >
        <MaterialIcon name="arrow_back" size={18} />
        {t('admin.promotions.backToList')}
      </Link>

      <header className="mb-6">
        <h1 className="font-headline-md text-headline-md text-primary">
          {t('admin.promotions.newHeading')}
        </h1>
        <p className="text-body-lg text-on-surface-variant mt-2">
          {t('admin.promotions.newSubtitle')}
        </p>
      </header>

      <Tabs<NewTabKey>
        active={tab}
        tabs={NEW_TABS.map((nt) => ({ ...nt, label: t(nt.label) }))}
      />

      <div className="mt-6">
        {tab === 'code' ? (
          <PromotionForm mode="create" roomTypes={roomTypeNames} />
        ) : (
          <SeasonalRateForm roomTypes={roomTypes} />
        )}
      </div>
    </div>
  )
}
