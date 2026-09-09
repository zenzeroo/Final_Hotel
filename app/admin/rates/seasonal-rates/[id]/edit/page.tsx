import { notFound } from 'next/navigation'
import Link from 'next/link'
import { listSeasonalRates } from '@/lib/data/manager'
import { listRoomTypes } from '@/lib/data/rooms'
import { SeasonalRateForm } from '@/components/admin/SeasonalRateForm'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export const dynamic = 'force-dynamic'

export default async function EditSeasonalRatePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [seasonalRates, roomTypes] = await Promise.all([
    listSeasonalRates(),
    listRoomTypes(),
  ])
  const rate = seasonalRates.find((r) => r.id === id)
  if (!rate) notFound()

  return (
    <div className="p-8 lg:p-12 max-w-3xl">
      <Link
        href="/admin/rates/seasonal-rates"
        className="inline-flex items-center gap-2 px-2 py-1 rounded text-body-md text-primary hover:bg-primary-fixed hover:text-primary mb-4"
      >
        <MaterialIcon name="arrow_back" size={18} />
        กลับไปหน้ารายการช่วงลดราคา
      </Link>

      <header className="mb-8">
        <h1 className="font-headline-md text-headline-md text-primary">
          แก้ไขช่วงราคา: {rate.label}
        </h1>
        <p className="text-body-lg text-on-surface-variant mt-2">
          {rate.room_type_name ?? rate.room_type_id}
        </p>
      </header>

      <SeasonalRateForm mode="edit" initial={rate} roomTypes={roomTypes} />
    </div>
  )
}
