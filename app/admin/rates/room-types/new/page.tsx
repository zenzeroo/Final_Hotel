import Link from 'next/link'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { RoomTypeForm } from '@/components/admin/RoomTypeForm'
import { getAmenityCatalog } from '@/lib/data/rooms'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

export default async function NewRoomTypePage() {
  const t = getT(await getLocale())
  return (
    <div className="p-8 lg:p-12 max-w-4xl">
      <Link
        href="/admin/rates/room-types"
        className="inline-flex items-center gap-2 px-2 py-1 rounded text-body-md text-primary hover:bg-primary-fixed hover:text-primary mb-4 transition-colors duration-200"
      >
        <MaterialIcon name="arrow_back" size={18} />
        {t('admin.roomTypes.backToList')}
      </Link>

      <header className="mb-6">
        <h1 className="font-headline-md text-headline-md text-primary">
          {t('admin.roomTypes.createNew')}
        </h1>
        <p className="text-body-lg text-on-surface-variant mt-2">
          {t('admin.roomTypes.newSubtitle')}
        </p>
      </header>

      <RoomTypeForm mode="create" amenityCatalog={getAmenityCatalog()} />
    </div>
  )
}
