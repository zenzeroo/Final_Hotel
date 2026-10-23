'use client'

import { useState } from 'react'
import type { RoomType } from '@/lib/data/types'
import { useLocale, useT } from '@/lib/i18n/useT'
import { localizedName } from '@/lib/format/roomType'
import { RoomImage } from './RoomImage'
import { ImageLightbox } from './ImageLightbox'

interface RoomGalleryProps {
  room: RoomType
}

/** Grid tiles shown before the "+N" overlay; the rest open in the viewer. */
const MAX_TILES = 4

/**
 * Phase 59 — the layout follows the number of photos (1 = full width,
 * 2 = two columns, 3 = hero + two stacked, 4+ = hero + three with a "+N"
 * overlay), and every tile opens the full-screen viewer. Gallery photos
 * that fail to load are dropped instead of leaving a placeholder tile;
 * the hero keeps RoomImage's fallback. Phones show only the hero with a
 * "+N" badge (the viewer has the rest) instead of a long stack of tiles.
 */
export function RoomGallery({ room }: RoomGalleryProps) {
  const t = useT()
  const name = localizedName(room, useLocale())
  const [failed, setFailed] = useState<Set<string>>(new Set())
  const [viewer, setViewer] = useState<number | null>(null)

  const all = [...new Set([room.hero_image_key, ...room.gallery_keys].filter(Boolean))] as string[]
  const images = all.filter((key, i) => i === 0 || !failed.has(key))
  const count = images.length
  const hidden = count - MAX_TILES

  const markFailed = (key: string) =>
    setFailed((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))

  const tile = (i: number, className: string, sizes: string) => {
    const key = images[i]
    const isHero = i === 0
    const showMore = i === MAX_TILES - 1 && hidden > 0
    return (
      <button
        key={key ?? `hero-${i}`}
        type="button"
        onClick={() => setViewer(i)}
        aria-label={t('customer.gallery.viewImage', { n: i + 1 })}
        className={`group relative rounded-2xl overflow-hidden bg-surface-container cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${isHero ? '' : 'hidden md:block'} ${className}`}
      >
        <RoomImage
          imageKey={key}
          alt={isHero ? name : `${name} ${i + 1}`}
          fill
          priority={isHero}
          sizes={sizes}
          className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          fallbackIcon={isHero ? 'hotel' : 'image'}
          onError={isHero || !key ? undefined : () => markFailed(key)}
        />
        {isHero && count > 1 && (
          <span className="md:hidden absolute bottom-3 right-3 px-3 py-1.5 rounded-full bg-black/60 text-white text-label-md font-semibold">
            {t('customer.gallery.moreCount', { count: count - 1 })}
          </span>
        )}
        {isHero && (
          <span className="absolute top-4 left-4 px-4 py-2 bg-secondary text-on-secondary rounded-full text-label-md font-semibold uppercase tracking-wider">
            {t('customer.gallery.collection')}
          </span>
        )}
        {showMore && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white font-semibold text-headline-sm">
            {t('customer.gallery.moreCount', { count: hidden })}
          </span>
        )}
      </button>
    )
  }

  let grid
  if (count <= 1) {
    grid = <div className="grid grid-cols-1">{tile(0, 'h-[300px] md:h-[480px]', '(max-width: 768px) 100vw, 66vw')}</div>
  } else if (count === 2) {
    grid = (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:h-[480px]">
        {tile(0, 'min-h-[300px] md:min-h-0', '(max-width: 768px) 100vw, 33vw')}
        {tile(1, 'min-h-[200px] md:min-h-0', '(max-width: 768px) 100vw, 33vw')}
      </div>
    )
  } else {
    grid = (
      <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-3 md:h-[600px]">
        {tile(0, 'md:col-span-2 md:row-span-2 min-h-[300px] md:min-h-0', '(max-width: 768px) 100vw, 33vw')}
        {count === 3 ? (
          <>
            {tile(1, 'md:col-span-2 min-h-[200px] md:min-h-0', '(max-width: 768px) 100vw, 33vw')}
            {tile(2, 'md:col-span-2 min-h-[200px] md:min-h-0', '(max-width: 768px) 100vw, 33vw')}
          </>
        ) : (
          <>
            {tile(1, 'md:col-span-2 min-h-[200px] md:min-h-0', '(max-width: 768px) 100vw, 33vw')}
            {tile(2, 'min-h-[200px] md:min-h-0', '(max-width: 768px) 100vw, 17vw')}
            {tile(3, 'min-h-[200px] md:min-h-0', '(max-width: 768px) 100vw, 17vw')}
          </>
        )}
      </div>
    )
  }

  return (
    <>
      {grid}
      {viewer !== null && count > 0 && (
        <ImageLightbox
          images={images}
          index={Math.min(viewer, count - 1)}
          alt={name}
          onIndexChange={setViewer}
          onClose={() => setViewer(null)}
        />
      )}
    </>
  )
}
