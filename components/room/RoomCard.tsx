import Link from 'next/link'
import type { RoomType } from '@/lib/data/types'
import { formatTHB } from '@/lib/pricing'
import { RoomImage } from './RoomImage'
import { RatingStars } from './RatingStars'
import { MaterialIcon } from '../ui/MaterialIcon'

interface RoomCardProps {
  room: RoomType
  variant?: 'default' | 'featured'
}

export function RoomCard({ room, variant = 'default' }: RoomCardProps) {
  const isFeatured = variant === 'featured'

  return (
    <Link
      href={`/rooms/${room.slug}`}
      className="group flex flex-col bg-surface-container-lowest rounded-2xl overflow-hidden shadow-(--shadow-ambient) transition-all duration-300 hover:shadow-(--shadow-ambient-md) hover:-translate-y-1"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <RoomImage
          imageKey={room.hero_image_key}
          alt={room.name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {isFeatured && room.rating_avg >= 4.8 && (
          <span className="absolute top-4 left-4 inline-flex items-center gap-1 px-3 py-1.5 bg-secondary text-on-secondary rounded-full text-caption font-semibold uppercase tracking-wider">
            <MaterialIcon name="local_fire_department" size={14} filled />
            แนะนำ
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-6 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-xl text-primary font-semibold">{room.name_th}</h3>
        </div>
        <p className="text-body-md text-on-surface-variant line-clamp-2 flex-1 mb-0">{room.short_desc}</p>

        <div className="flex items-center justify-between mt-2">
          <RatingStars value={room.rating_avg} count={room.rating_count} size={16} />
        </div>

        <div className="flex items-center justify-between mt-2 pt-4 border-t border-outline-variant gap-3">
          <div className="min-w-0">
            <span className="text-caption text-on-surface-variant block">เริ่มต้น</span>
            <span className="text-2xl font-display font-bold text-primary whitespace-nowrap">{formatTHB(room.base_price)}</span>
            <span className="text-body-md text-on-surface-variant whitespace-nowrap"> / คืน</span>
          </div>
          <span
            className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary text-secondary transition-transform duration-300 group-hover:translate-x-1"
            aria-label="ดูรายละเอียด"
          >
            <MaterialIcon name="arrow_forward" size={20} />
          </span>
        </div>
      </div>
    </Link>
  )
}
