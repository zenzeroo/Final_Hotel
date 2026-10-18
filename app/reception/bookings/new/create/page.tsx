import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WalkInForm } from './WalkInForm'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

export default async function CreateWalkInBookingPage(props: PageProps<'/reception/bookings/new/create'>) {
  const t = getT(await getLocale())
  const searchParams = await props.searchParams
  const roomId = typeof searchParams.roomId === 'string' ? searchParams.roomId : null
  if (!roomId) redirect('/reception/bookings/new')

  const supabase = await createClient()
  const { data: room, error } = await supabase
    .from('room_types')
    .select('id, slug, name, name_th, base_price, max_guests, hero_image_key')
    .eq('id', roomId)
    .maybeSingle()

  if (error || !room) notFound()

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-primary">{t('reception.walkIn.createHeading')}</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          {t('reception.walkIn.createSubtitle')}
        </p>
      </div>

      <WalkInForm
        room={{
          id: room.id,
          slug: room.slug,
          name: room.name,
          name_th: room.name_th,
          hero_image_key: room.hero_image_key,
          base_price: room.base_price,
          max_guests: room.max_guests,
        }}
      />
    </div>
  )
}
