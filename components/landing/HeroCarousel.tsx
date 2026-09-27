'use client'

/**
 * Phase 43 — Public homepage hero carousel.
 *
 * Renders all slides as a crossfade stack with left/right arrow buttons +
 * dot indicators. NO auto-rotate — pure manual navigation per the design
 * decision. Keyboard left/right arrows also navigate when the section is
 * focused.
 *
 * The default overlay text (label + heading + subheading) is shown when a
 * slide doesn't override it (room_type source, or custom without caption).
 * Promotion + custom_with_caption slides override the heading/subheading
 * per Section 2e of the plan.
 *
 * Respects `prefers-reduced-motion: reduce` via the Tailwind utility
 * `motion-safe:` (which checks the media query). All transitions are
 * opacity only — no transforms that would trigger vestibular issues.
 *
 * Server-rendered initial state via the `initialIndex` prop (defaults to 0).
 * Client state lives in `activeIdx` — changing it triggers a re-render
 * with the new slide visible.
 *
 * The overlay SearchBar (variant="overlay") sits on top of the hero and
 * auto-navigates to /rooms when dates/guests change (debounced 400ms).
 */
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { SearchBar } from '@/components/search/SearchBar'
import { r2Url } from '@/lib/r2/publicUrl'
import type { ResolvedHeroSlide } from '@/lib/data/types'

interface HeroCarouselProps {
  slides: ResolvedHeroSlide[]
  /**
   * Default heading (TH) — used when a slide doesn't provide its own.
   * Kept as a prop so the page component can pass i18n strings down.
   */
  defaultLabel: string
  defaultHeading: string
  defaultSubheading: string
}

export function HeroCarousel({
  slides,
  defaultLabel,
  defaultHeading,
  defaultSubheading,
}: HeroCarouselProps) {
  const [activeIdxRaw, setActiveIdx] = useState(0)
  const total = slides.length

  // Clamp active index if total changes (e.g. admin deletes a slide +
  // revalidation). Compute in render so React doesn't flag "setState in
  // useEffect" — the activeIdx variable below is the safe value used by
  // every downstream consumer.
  const activeIdx = total === 0 ? 0 : Math.min(activeIdxRaw, total - 1)

  // Keyboard navigation — left/right arrows when section is focused.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName
      // Only react when the user isn't typing in an input/textarea/contenteditable.
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.target as HTMLElement | null)?.isContentEditable) return
      if (total === 0) return
      if (e.key === 'ArrowLeft') {
        setActiveIdx((i) => (i - 1 + total) % total)
      } else if (e.key === 'ArrowRight') {
        setActiveIdx((i) => (i + 1) % total)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total])

  const goPrev = () => setActiveIdx((i) => (i - 1 + total) % total)
  const goNext = () => setActiveIdx((i) => (i + 1) % total)
  const goTo = (i: number) => setActiveIdx(i)

  return (
    <section
      role="region"
      aria-roledescription="carousel"
      aria-label="ภาพหน้าแรก"
      tabIndex={0}
      className="relative h-[85vh] min-h-[600px] flex items-center justify-center overflow-hidden focus:outline-none focus-visible:outline-2 focus-visible:outline-secondary"
    >
      {/* Slide stack */}
      <div className="absolute inset-0">
        {slides.map((slide, idx) => {
          const isActive = idx === activeIdx
          const heading = slide.heading ?? defaultHeading
          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`สไลด์ที่ ${idx + 1} จาก ${total}: ${heading}`}
              aria-hidden={!isActive}
              className={`absolute inset-0 motion-safe:transition-opacity motion-safe:duration-500 motion-safe:ease-in-out ${
                isActive ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <Image
                src={r2Url(slide.imageKey)}
                alt={heading}
                fill
                priority={idx === 0}
                sizes="100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-primary/40 mix-blend-multiply" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-primary/60" />
            </div>
          )
        })}
      </div>

      {/* Heading — positioned in the upper-middle area of the hero (above the
          center line). Static across all slides — the carousel only swaps
          background images, the heading text stays constant. */}
      <div className="absolute top-[38%] left-0 right-0 z-10 -translate-y-1/2 px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) flex flex-col items-center text-center pointer-events-none">
        <span className="text-label-md text-secondary font-semibold uppercase tracking-wider mb-4">
          {defaultLabel}
        </span>
        <h1 className="font-display text-4xl md:text-6xl lg:text-7xl text-on-primary font-bold leading-tight max-w-3xl">
          {defaultHeading}
        </h1>
        {defaultSubheading && (
          <p className="text-body-lg text-on-primary/90 mt-6 max-w-xl">
            {defaultSubheading}
          </p>
        )}
      </div>

      {/* Arrow buttons — semi-transparent, vertically centered.
          Positioned at top-1/2 so they sit beside (not over) the centered
          SearchBar on desktop. On mobile they shrink + move to corners. */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="สไลด์ก่อนหน้า"
            className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-20 inline-flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/30 hover:bg-primary/50 backdrop-blur-sm text-on-primary transition-colors"
          >
            <MaterialIcon name="chevron_left" size={28} />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="สไลด์ถัดไป"
            className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-20 inline-flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/30 hover:bg-primary/50 backdrop-blur-sm text-on-primary transition-colors"
          >
            <MaterialIcon name="chevron_right" size={28} />
          </button>
        </>
      )}

      {/* Overlay SearchBar — below the dots, near the bottom of the hero.
          variant="overlay" auto-navigates to /rooms on date/guests change. */}
      <div className="absolute inset-x-0 z-20 px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) bottom-0 pb-6 md:bottom-auto md:top-[76%] md:pb-0">
        <div className="max-w-(--spacing-container-max) mx-auto">
          <SearchBar variant="hero" />
        </div>
      </div>

      {/* Dot indicators — just above the SearchBar (between heading and SearchBar). */}
      {total > 1 && (
        <div className="absolute bottom-28 md:bottom-auto md:top-[70%] left-0 right-0 z-20 flex items-center justify-center gap-2">
          {slides.map((slide, idx) => {
            const isActive = idx === activeIdx
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => goTo(idx)}
                aria-label={`ไปยังสไลด์ที่ ${idx + 1}`}
                aria-current={isActive ? 'true' : undefined}
                className={`h-2 rounded-full motion-safe:transition-all motion-safe:duration-300 ${
                  isActive
                    ? 'w-8 bg-secondary'
                    : 'w-2 bg-secondary/30 hover:bg-secondary/50'
                }`}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
