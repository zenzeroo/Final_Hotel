import { createClient } from '@/lib/supabase/server'
import { formatTHB } from '@/lib/pricing'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { CheckInOutActions } from './CheckInOutActions'

export const dynamic = 'force-dynamic'

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('th-TH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

export default async function CheckInOutPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const [checkInsRes, checkOutsRes, inHouseRes] = await Promise.all([
    supabase
      .from('bookings')
      .select(`
        *,
        room_type:room_types(id, name, name_th, hero_image_key)
      `)
      .eq('check_in', today)
      .in('status', ['confirmed', 'checked_in'])
      .order('check_in'),
    supabase
      .from('bookings')
      .select(`
        *,
        room_type:room_types(id, name, name_th, hero_image_key)
      `)
      .eq('check_out', today)
      .eq('status', 'checked_in')
      .order('check_out'),
    supabase
      .from('bookings')
      .select(`
        *,
        room_type:room_types(id, name, name_th, hero_image_key)
      `)
      .eq('status', 'checked_in')
      .order('check_out'),
  ])

  const checkIns = checkInsRes.data ?? []
  const checkOuts = checkOutsRes.data ?? []
  const inHouse = inHouseRes.data ?? []

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-primary">เช็คอิน / เช็คเอาท์</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          {formatDate(today)}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Check-ins today */}
        <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
          <div className="flex items-center gap-3 mb-4">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
              <MaterialIcon name="login" size={20} />
            </div>
            <h2 className="font-display text-xl text-primary">เช็คอินวันนี้</h2>
            <span className="ml-auto px-3 py-1 rounded-full bg-primary text-secondary text-caption font-semibold">
              {checkIns.length}
            </span>
          </div>
          {checkIns.length === 0 ? (
            <p className="text-body-md text-on-surface-variant text-center py-8">ไม่มีเช็คอินวันนี้</p>
          ) : (
            <div className="flex flex-col gap-3">
              {checkIns.map((b) => (
                <GuestCard
                  key={b.id}
                  booking={b}
                  action={
                    b.status === 'confirmed' ? (
                      <CheckInOutActions bookingId={b.id} action="check_in" label="เช็คอิน" />
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-caption font-semibold">
                        <MaterialIcon name="verified" size={14} /> เข้าพักแล้ว
                      </span>
                    )
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* Check-outs today */}
        <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
          <div className="flex items-center gap-3 mb-4">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-secondary/20 text-secondary">
              <MaterialIcon name="logout" size={20} />
            </div>
            <h2 className="font-display text-xl text-primary">เช็คเอาท์วันนี้</h2>
            <span className="ml-auto px-3 py-1 rounded-full bg-secondary text-on-secondary text-caption font-semibold">
              {checkOuts.length}
            </span>
          </div>
          {checkOuts.length === 0 ? (
            <p className="text-body-md text-on-surface-variant text-center py-8">ไม่มีเช็คเอาท์วันนี้</p>
          ) : (
            <div className="flex flex-col gap-3">
              {checkOuts.map((b) => (
                <GuestCard
                  key={b.id}
                  booking={b}
                  action={
                    <CheckInOutActions
                      bookingId={b.id}
                      action="check_out"
                      label="เช็คเอาท์"
                    />
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* In-house guests */}
      <section className="mt-8 bg-surface-container-lowest rounded-2xl p-6 shadow-(--shadow-ambient) border border-outline-variant">
        <div className="flex items-center gap-3 mb-4">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary text-secondary">
            <MaterialIcon name="group" size={20} />
          </div>
          <h2 className="font-display text-xl text-primary">แขกที่พักอยู่ในขณะนี้</h2>
          <span className="ml-auto px-3 py-1 rounded-full bg-primary text-secondary text-caption font-semibold">
            {inHouse.length}
          </span>
        </div>
        {inHouse.length === 0 ? (
          <p className="text-body-md text-on-surface-variant text-center py-8">ไม่มีแขกที่เข้าพักอยู่</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {inHouse.map((b) => (
              <div key={b.id} className="p-4 bg-surface-container-low rounded-xl">
                <p className="text-body-md font-semibold text-on-surface truncate">{b.booker_full_name}</p>
                <p className="text-caption text-on-surface-variant truncate">
                  {b.room_type?.name_th}
                </p>
                <div className="mt-2 flex items-center gap-1.5 text-caption text-on-surface-variant">
                  <MaterialIcon name="event" size={14} />
                  เช็คเอาท์ {formatDate(b.check_out)}
                </div>
                <div className="mt-1 text-caption text-on-surface-variant">
                  {b.guests} ท่าน · {formatTHB(b.total)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function GuestCard({
  booking,
  action,
}: {
  booking: any
  action: React.ReactNode
}) {
  return (
    <div className="p-4 bg-surface-container-low rounded-xl flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-body-md font-semibold text-on-surface truncate">
          {booking.booker_full_name}
        </p>
        <p className="text-caption text-on-surface-variant truncate">
          {booking.room_type?.name_th} · {booking.guests} ท่าน
        </p>
        <p className="text-caption text-on-surface-variant mt-0.5 font-mono">
          #{booking.booking_code}
        </p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )
}
