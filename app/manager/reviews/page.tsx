import { getReviewModerationQueue } from '@/lib/data/reviews'
import { getSession } from '@/lib/supabase/getSession'
import { ReviewsTabs } from '@/components/manager/ReviewsTabs'
import { ModerationQueue } from '@/components/manager/ModerationQueue'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

type Tab = 'pending' | 'approved' | 'hidden'

export default async function ManagerReviewsPage(props: {
  searchParams: Promise<{ tab?: string }>
}) {
  const locale = await getLocale()
  const t = getT(locale)
  const searchParams = await props.searchParams
  const tab: Tab = (['pending', 'approved', 'hidden'] as Tab[]).includes(
    (searchParams.tab as Tab) ?? 'pending',
  )
    ? ((searchParams.tab as Tab) ?? 'pending')
    : 'pending'

  const [data, session] = await Promise.all([getReviewModerationQueue(), getSession()])
  const isAdmin = session?.role === 'admin'

  const visibleReviews =
    tab === 'pending' ? data.pending : tab === 'approved' ? data.approved : data.hidden

  const emptyMessage =
    tab === 'pending'
      ? t('manager.reviewsPage.emptyPending')
      : tab === 'approved'
      ? t('manager.reviewsPage.emptyApproved')
      : t('manager.reviewsPage.emptyHidden')

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">{t('manager.reviewsPage.title')}</h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            {t('manager.reviewsPage.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 bg-surface-container-low rounded-full px-3 py-2">
            <MaterialIcon name="pending_actions" size={16} className="text-on-surface-variant" />
            <span className="text-body-md text-on-surface-variant">
              {t('manager.reviewsPage.pendingCount', { count: data.pendingCount })}
            </span>
          </div>
        </div>
      </header>

      <ReviewsTabs
        active={tab}
        pendingCount={data.pendingCount}
        approvedCount={data.approvedCount}
        hiddenCount={data.hiddenCount}
      />

      <ModerationQueue
        reviews={visibleReviews}
        tab={tab}
        isAdmin={isAdmin}
        emptyMessage={emptyMessage}
        locale={locale}
      />
    </div>
  )
}
