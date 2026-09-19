import Link from 'next/link'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { RoomTypeForm } from '@/components/admin/RoomTypeForm'

export const dynamic = 'force-dynamic'

export default async function NewRoomTypePage() {
  return (
    <div className="p-8 lg:p-12 max-w-4xl">
      <Link
        href="/admin/rates/room-types"
        className="inline-flex items-center gap-2 px-2 py-1 rounded text-body-md text-primary hover:bg-primary-fixed hover:text-primary mb-4 transition-colors duration-200"
      >
        <MaterialIcon name="arrow_back" size={18} />
        กลับไปหน้ารายการประเภทห้อง
      </Link>

      <header className="mb-6">
        <h1 className="font-headline-md text-headline-md text-primary">
          สร้างประเภทห้องใหม่
        </h1>
        <p className="text-body-lg text-on-surface-variant mt-2">
          เพิ่มประเภทห้องพัก ราคาฐาน และรูปภาพ
        </p>
      </header>

      <RoomTypeForm mode="create" />
    </div>
  )
}
