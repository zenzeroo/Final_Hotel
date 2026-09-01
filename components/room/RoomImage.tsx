'use client'

import Image, { type ImageProps } from 'next/image'
import { useState } from 'react'
import { r2Url } from '@/lib/r2/publicUrl'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface RoomImageProps extends Omit<ImageProps, 'src' | 'alt'> {
  imageKey: string | null | undefined
  alt: string
  fallbackIcon?: string
}

/**
 * Image wrapper for room hero/gallery images with graceful fallback.
 *
 * Renders a gradient + icon placeholder when:
 *   - `imageKey` is empty/null (e.g. mock data missing)
 *   - the underlying `<Image>` fails to load (404 / network error)
 *
 * Both branches use `absolute inset-0` to fill the parent — consumers
 * MUST wrap in a `relative` + sized container (matches `<Image fill>`).
 *
 * Client component (uses `useState` + `onError`) so server-component
 * parents can drop it in unchanged.
 */
export function RoomImage({
  imageKey,
  alt,
  fallbackIcon = 'image',
  className,
  ...rest
}: RoomImageProps) {
  const src = r2Url(imageKey)
  const [errored, setErrored] = useState(false)

  if (!src || errored) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={[
          'absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary-container to-secondary-container',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <MaterialIcon
          name={fallbackIcon}
          size={48}
          className="text-on-primary-container/60"
        />
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      onError={() => setErrored(true)}
      {...rest}
      className={className}
    />
  )
}
