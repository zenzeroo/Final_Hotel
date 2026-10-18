import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getRoomTypeById, getAmenityCatalog, listUnitsForRoomType } from '@/lib/data/rooms'
import { RoomTypeForm } from '@/components/admin/RoomTypeForm'
import { RoomUnitsSection } from '@/components/admin/RoomUnitsSection'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

export default async function EditRoomTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ created?: string }>
}) {
  const t = getT(await getLocale())
  const { id } = await params
  const { created } = await searchParams
  const roomType = await getRoomTypeById(id)
  if (!roomType) notFound()
  const units = await listUnitsForRoomType(id)

  return (
    <div className="p-8 lg:p-12 max-w-3xl">
      <Link
        href="/admin/rates/room-types"
        className="inline-flex items-center gap-2 px-2 py-1 rounded text-body-md text-primary hover:bg-primary-fixed hover:text-primary mb-4"
      >
        <MaterialIcon name="arrow_back" size={18} />
        {t('admin.roomTypes.backToList')}
      </Link>

      <header className="mb-8">
        <h1 className="font-headline-md text-headline-md text-primary">
          {t('admin.roomTypes.editHeading', { name: roomType.name })}
        </h1>
        <p className="text-body-lg text-on-surface-variant mt-2">{roomType.name_th}</p>
      </header>

      {created === '1' && (
        <div className="mb-6 px-4 py-3 bg-secondary-container text-on-secondary-container rounded-lg text-body-md inline-flex items-center gap-2">
          <MaterialIcon name="check_circle" size={18} />
          {t('admin.roomTypes.createdBanner')}
        </div>
      )}

      <RoomTypeForm mode="edit" initial={roomType} amenityCatalog={getAmenityCatalog()} />

      <RoomUnitsSection roomTypeId={roomType.id} defaultFloor={roomType.floor} units={units} />
    </div>
  )
}
