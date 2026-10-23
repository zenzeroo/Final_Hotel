'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { RoomImage } from './RoomImage'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useT } from '@/lib/i18n/useT'

/**
 * Phase 59 — full-screen photo viewer for the room gallery.
 * ←/→ switch photos, Esc or a click on the dark backdrop closes, page
 * scroll is locked while open and focus returns to the opening tile.
 */
export function ImageLightbox({
  images,
  index,
  alt,
  onIndexChange,
  onClose,
}: {
  images: string[]
  index: number
  alt: string
  onIndexChange: (index: number) => void
  onClose: () => void
}) {
  const t = useT()
  const closeRef = useRef<HTMLButtonElement>(null)
  const count = images.length
  const many = count > 1

  const go = (delta: number) => onIndexChange((index + delta + count) % count)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
      opener?.focus()
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (many && e.key === 'ArrowRight') onIndexChange((index + 1) % count)
      else if (many && e.key === 'ArrowLeft') onIndexChange((index - 1 + count) % count)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, count, many, onClose, onIndexChange])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('customer.gallery.viewImage', { n: index + 1 })}
      className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label={t('customer.gallery.close')}
        className="absolute top-4 right-4 w-11 h-11 inline-flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
      >
        <MaterialIcon name="close" size={24} />
      </button>

      {many && (
        <span className="absolute top-6 left-1/2 -translate-x-1/2 text-white/80 text-body-md tabular-nums">
          {t('customer.gallery.counter', { n: index + 1, total: count })}
        </span>
      )}

      <div
        className="relative w-[92vw] h-[78vh] md:w-[80vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <RoomImage
          key={images[index]}
          imageKey={images[index]}
          alt={`${alt} ${index + 1}`}
          fill
          sizes="100vw"
          className="object-contain"
        />
      </div>

      {many && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              go(-1)
            }}
            aria-label={t('customer.gallery.prev')}
            className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 w-11 h-11 inline-flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <MaterialIcon name="chevron_left" size={28} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              go(1)
            }}
            aria-label={t('customer.gallery.next')}
            className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 w-11 h-11 inline-flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <MaterialIcon name="chevron_right" size={28} />
          </button>
        </>
      )}
    </div>,
    document.body,
  )
}
