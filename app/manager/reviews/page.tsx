import { getReviewModerationQueue } from '@/lib/data/reviews'
import { getSession } from '@/lib/supabase/getSession'
import { ReviewsTabs } from '@/components/manager/ReviewsTabs'
import { ModerationQueue } from '@/components/manager/ModerationQueue'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export const dynamic = 'force-dynamic'

type Tab = 'pending' | 'approved' | 'hidden'

export default async function ManagerReviewsPage(props: {
  searchParams: Promise<{ tab?: string }>
}) {
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
      ? 'ไม่มีรีวิวรออนุมัติ'
      : tab === 'approved'
      ? 'ยังไม่มีรีวิวที่อนุมัติแล้ว'
      : 'ยังไม่มีรีวิวที่ซ่อนไว้'

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">จัดการรีวิว</h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            ตรวจสอบและอนุมัติรีวิวจากผู้เข้าพัก
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 bg-surface-container-low rounded-full px-3 py-2">
            <MaterialIcon name="pending_actions" size={16} className="text-on-surface-variant" />
            <span className="text-body-md text-on-surface-variant">
              {data.pendingCount} รออนุมัติ
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
      />
    </div>
  )
}
