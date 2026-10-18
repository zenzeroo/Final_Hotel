import { notFound } from 'next/navigation'
import { getPromotionById } from '@/lib/data/manager'
import { getRoomTypes } from '@/lib/data/rooms'
import { PromotionForm } from '@/components/admin/PromotionForm'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import Link from 'next/link'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

export default async function EditPromotionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const t = getT(await getLocale())
  const { id } = await params
  const [promotion, roomTypes] = await Promise.all([
    getPromotionById(id),
    getRoomTypes(),
  ])
  if (!promotion) notFound()

  return (
    <div className="p-8 lg:p-12 max-w-3xl">
      <Link
        href="/admin/promotions"
        className="inline-flex items-center gap-2 px-2 py-1 rounded text-body-md text-primary hover:bg-primary-fixed hover:text-primary mb-4"
      >
        <MaterialIcon name="arrow_back" size={18} />
        {t('admin.promotions.backToList')}
      </Link>

      <header className="mb-8">
        <h1 className="font-headline-md text-headline-md text-primary">
          {t('admin.promotions.editHeading', { code: promotion.code })}
        </h1>
        <p className="text-body-lg text-on-surface-variant mt-2">{promotion.name}</p>
      </header>

      <PromotionForm mode="edit" initial={promotion} roomTypes={roomTypes} />
    </div>
  )
}
