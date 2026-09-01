import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { RoomImage } from '@/components/room/RoomImage'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { formatTHB } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

export default async function WalkInBookingPage() {
  const supabase = await createClient()
  const { data: rooms, error } = await supabase
    .from('room_types')
    .select('id, slug, name, name_th, base_price, type, max_guests, hero_image_key, short_desc')
    .eq('is_active', true)
    .order('base_price')

  if (error) {
    return <p className="p-8 text-error">เกิดข้อผิดพลาด: {error.message}</p>
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-primary">การจองแบบ Walk-in</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          เลือกห้องพักเพื่อสร้างการจองสำหรับลูกค้าที่มาถึงโดยไม่ได้จองล่วงหน้า
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms?.map((room) => (
          <Link
            key={room.id}
            href={`/reception/bookings/new/create?roomId=${room.id}`}
            className="group flex flex-col bg-surface-container-lowest rounded-2xl overflow-hidden shadow-(--shadow-ambient) border border-outline-variant hover:shadow-(--shadow-ambient-md) transition-all"
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              <RoomImage
                imageKey={room.hero_image_key}
                alt={room.name}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <span className="absolute top-3 left-3 px-3 py-1 bg-primary text-secondary rounded-full text-caption font-semibold uppercase tracking-wider">
                {room.type}
              </span>
            </div>
            <div className="p-5 flex flex-col flex-1">
              <h3 className="font-display text-lg text-primary">{room.name_th}</h3>
              <p className="text-caption text-on-surface-variant line-clamp-2 flex-1 mb-0">
                {room.short_desc}
              </p>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-caption text-on-surface-variant">เริ่มต้น</span>
                  <span className="text-xl font-display font-bold text-primary ml-1 whitespace-nowrap">
                    {formatTHB(room.base_price)}
                  </span>
                </div>
                <span className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary text-secondary">
                  <MaterialIcon name="arrow_forward" size={18} />
                </span>
              </div>
              <p className="text-caption text-on-surface-variant mt-2">
                สูงสุด {room.max_guests} ท่าน
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
