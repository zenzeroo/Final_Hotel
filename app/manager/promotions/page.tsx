import { listPromotions } from '@/lib/data/manager'
import { PromotionsTable } from '@/components/manager/PromotionsTable'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export const dynamic = 'force-dynamic'

export default async function ManagerPromotionsPage() {
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
            Promotions & Discounts
          </h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            เปิด/ปิดโปรโมชั่น — การสร้างและแก้ไขทำได้ผ่าน Admin
          </p>
        </div>
        <div className="inline-flex items-center gap-2 bg-surface-container-low rounded-full px-4 py-2">
          <MaterialIcon name="sell" size={18} className="text-on-surface-variant" />
          <span className="text-body-md text-on-surface-variant">
            {promotions.length} รายการ
          </span>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            เปิดใช้งาน
          </p>
          <p className="font-display-lg text-display-lg-mobile text-primary">{activeCount}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            ปิดใช้งาน
          </p>
          <p className="font-display-lg text-display-lg-mobile text-primary">
            {promotions.length - activeCount}
          </p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            หมดอายุ
          </p>
          <p className="font-display-lg text-display-lg-mobile text-error">{expiredCount}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            ยังไม่เริ่ม
          </p>
          <p className="font-display-lg text-display-lg-mobile text-secondary">{upcomingCount}</p>
        </div>
      </section>

      <PromotionsTable promotions={promotions} now={now} />
    </div>
  )
}
