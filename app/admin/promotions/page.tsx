import { listPromotions } from '@/lib/data/manager'
import { PromotionsAdminTable } from '@/components/admin/PromotionsAdminTable'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import Link from 'next/link'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

export default async function AdminPromotionsPage() {
  const t = getT(await getLocale())
  const promotions = await listPromotions()
  const now = new Date()

  const activeCount = promotions.filter((p) => p.is_active).length
  const expiredCount = promotions.filter(
    (p) => new Date(p.valid_until).getTime() < now.getTime(),
  ).length
  const upcomingCount = promotions.filter(
    (p) => new Date(p.valid_from).getTime() > now.getTime(),
  ).length

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            {t('admin.promotions.heading')}
          </h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            {t('admin.promotions.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/admin/promotions/new"
            className="inline-flex items-center gap-2 bg-primary text-on-primary rounded-lg px-4 py-2 hover:bg-primary-fixed hover:text-primary transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
          >
            <MaterialIcon name="add" size={18} />
            {t('admin.promotions.createNew')}
          </Link>
          <div className="inline-flex items-center gap-2 bg-surface-container-low rounded-full px-4 py-2">
            <MaterialIcon name="sell" size={18} className="text-on-surface-variant" />
            <span className="text-body-md text-on-surface-variant">
              {t('admin.promotions.itemsCount', { count: promotions.length })}
            </span>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            {t('admin.promotions.kpiActive')}
          </p>
          <p className="font-display-lg text-display-lg-mobile text-primary">{activeCount}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            {t('admin.promotions.kpiExpired')}
          </p>
          <p className="font-display-lg text-display-lg-mobile text-error">{expiredCount}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            {t('admin.promotions.kpiUpcoming')}
          </p>
          <p className="font-display-lg text-display-lg-mobile text-secondary">{upcomingCount}</p>
        </div>
      </section>

      <section>
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          {t('admin.promotions.allHeading')}
        </h2>
        <PromotionsAdminTable promotions={promotions} now={now} />
      </section>
    </div>
  )
}
