import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getRoomTypeById } from '@/lib/data/rooms'
import { RoomTypeForm } from '@/components/admin/RoomTypeForm'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export const dynamic = 'force-dynamic'

export default async function EditRoomTypePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const roomType = await getRoomTypeById(id)
  if (!roomType) notFound()

  return (
    <div className="p-8 lg:p-12 max-w-3xl">
      <Link
        href="/admin/rates/room-types"
        className="inline-flex items-center gap-2 px-2 py-1 rounded text-body-md text-primary hover:bg-primary-fixed hover:text-primary mb-4"
      >
        <MaterialIcon name="arrow_back" size={18} />
        กลับไปหน้ารายการประเภทห้อง
      </Link>

      <header className="mb-8">
        <h1 className="font-headline-md text-headline-md text-primary">
          แก้ไขประเภทห้อง: {roomType.name}
        </h1>
        <p className="text-body-lg text-on-surface-variant mt-2">{roomType.name_th}</p>
      </header>

      <RoomTypeForm mode="edit" initial={roomType} />
    </div>
  )
}
