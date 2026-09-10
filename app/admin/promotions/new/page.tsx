import { getRoomTypes } from '@/lib/data/rooms'
import { PromotionForm } from '@/components/admin/PromotionForm'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function NewPromotionPage() {
  const roomTypes = await getRoomTypes()

  return (
    <div className="p-8 lg:p-12 max-w-3xl">
      <Link
        href="/admin/promotions"
        className="inline-flex items-center gap-2 px-2 py-1 rounded text-body-md text-primary hover:bg-primary-fixed hover:text-primary mb-4 transition-colors duration-200"
      >
        <MaterialIcon name="arrow_back" size={18} />
        กลับไปหน้ารายการโปรโมชั่น
      </Link>

      <header className="mb-8">
        <h1 className="font-headline-md text-headline-md text-primary">
          สร้างโปรโมชั่นใหม่
        </h1>
        <p className="text-body-lg text-on-surface-variant mt-2">
          กรอกรายละเอียดโปรโมชั่นเพื่อเปิดใช้งาน
        </p>
      </header>

      <PromotionForm mode="create" roomTypes={roomTypes} />
    </div>
  )
}
