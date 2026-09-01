import type { RoomType } from '@/lib/data/types'
import { RoomImage } from './RoomImage'

interface RoomGalleryProps {
  room: RoomType
}

export function RoomGallery({ room }: RoomGalleryProps) {
  const images = [...new Set([room.hero_image_key, ...room.gallery_keys])]

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:grid-rows-2 md:h-[600px]">
      {/* Hero image (spans 2 cols, 2 rows on desktop) */}
      <div className="relative md:col-span-2 md:row-span-2 rounded-2xl overflow-hidden bg-surface-container min-h-[300px] md:min-h-0">
        <RoomImage
          imageKey={images[0]}
          alt={room.name}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
          fallbackIcon="hotel"
        />
        <span className="absolute top-4 left-4 px-4 py-2 bg-secondary text-on-secondary rounded-full text-label-md font-semibold uppercase tracking-wider">
          คอลเลกชั่นพิเศษ
        </span>
      </div>

      {/* Thumbnail 1 */}
      {images[1] && (
        <div className="relative md:col-span-2 rounded-2xl overflow-hidden bg-surface-container min-h-[200px]">
          <RoomImage
            imageKey={images[1]}
            alt={`${room.name} 2`}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
            fallbackIcon="image"
          />
        </div>
      )}

      {/* Thumbnail 2 */}
      {images[2] && (
        <div className="relative rounded-2xl overflow-hidden bg-surface-container min-h-[200px]">
          <RoomImage
            imageKey={images[2]}
            alt={`${room.name} 3`}
            fill
            sizes="(max-width: 768px) 100vw, 25vw"
            className="object-cover"
            fallbackIcon="image"
          />
        </div>
      )}

      {/* Thumbnail 3 (with placeholder/gradient) */}
      {images[3] ? (
        <div className="relative rounded-2xl overflow-hidden bg-surface-container min-h-[200px]">
          <RoomImage
            imageKey={images[3]}
            alt={`${room.name} 4`}
            fill
            sizes="(max-width: 768px) 100vw, 25vw"
            className="object-cover"
            fallbackIcon="image"
          />
        </div>
      ) : (
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-primary to-primary-container min-h-[200px] flex items-center justify-center">
          <span className="text-secondary text-label-md font-semibold uppercase tracking-wider">
            + ดูเพิ่มเติม
          </span>
        </div>
      )}
    </div>
  )
}
