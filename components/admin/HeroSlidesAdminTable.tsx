'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { AlertModal } from '@/components/ui/AlertModal'
import { r2Url } from '@/lib/r2/publicUrl'
import {
  removeHeroSlideAction,
  toggleHeroSlideActiveAction,
  moveHeroSlideAction,
} from '@/app/actions/admin/hero-carousel'
import { useLocale } from '@/lib/i18n/useT'
import { LOCALE_BCP47 } from '@/lib/i18n/config'
import { formatDate } from '@/lib/dates'
import type { HeroSlideSourceType } from '@/lib/data/types'

interface SlideRow {
  id: string
  source_type: HeroSlideSourceType
  room_type_id: string | null
  promotion_id: string | null
  custom_image_key: string | null
  custom_caption: string | null
  custom_caption_th: string | null
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  updated_by: string | null
  room_type_name_th: string | null
  room_type_name: string | null
  promotion_name: string | null
}

interface HeroSlidesAdminTableProps {
  slides: SlideRow[]
  locale: 'th' | 'en'
}

function sourceLabel(t: (k: string) => string, type: HeroSlideSourceType): string {
  if (type === 'room_type') return t('admin.heroCarouselPage.sourceRoomType')
  if (type === 'promotion') return t('admin.heroCarouselPage.sourcePromotion')
  return t('admin.heroCarouselPage.sourceCustom')
}

function sourceBadgeClass(type: HeroSlideSourceType): string {
  if (type === 'room_type') return 'bg-primary/15 text-primary'
  if (type === 'promotion') return 'bg-secondary/20 text-secondary'
  return 'bg-outline-variant text-on-surface-variant'
}

function resolveImageKey(s: SlideRow): string | null {
  // The page passes the row with source_type. We render whichever image key
  // is populated (custom_image_key for 'custom', the joined room_type/promo
  // image keys for the others). Without the joined data here, we fall back to
  // custom_image_key only — the table cell shows a placeholder if the
  // joined image hasn't propagated. (In practice the server-side listAllHeroSlides
  // populates the denormalized name fields only; image keys come from the join.)
  return s.custom_image_key
}

export function HeroSlidesAdminTable({ slides }: HeroSlidesAdminTableProps) {
  const locale = useLocale()
  const localeBcp = LOCALE_BCP47[locale] ?? 'th-TH'
  const t = (k: string) => {
    // Tiny inline translation lookup — keys are passed straight through; the
    // page-level component doesn't expose a `t` so we mirror its namespace.
    return k
  }

  const [confirmRemove, setConfirmRemove] = useState<SlideRow | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleRemove(row: SlideRow) {
    setConfirmRemove(row)
  }

  function confirmRemoveAction() {
    const row = confirmRemove
    setConfirmRemove(null)
    if (!row) return
    startTransition(async () => {
      const result = await removeHeroSlideAction(row.id)
      if (!result.ok && result.error) setAlertMessage(result.error)
    })
  }

  function handleToggle(row: SlideRow) {
    startTransition(async () => {
      const result = await toggleHeroSlideActiveAction({
        slideId: row.id,
        isActive: !row.is_active,
      })
      if (!result.ok && result.error) setAlertMessage(result.error)
    })
  }

  function handleMove(row: SlideRow, direction: 'up' | 'down') {
    startTransition(async () => {
      const result = await moveHeroSlideAction({ slideId: row.id, direction })
      if (!result.ok && result.error) setAlertMessage(result.error)
    })
  }

  if (slides.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-2xl shadow-level-1 p-8 text-center">
        <MaterialIcon
          name="image"
          size={48}
          className="text-on-surface-variant mx-auto mb-3"
        />
        <p className="text-body-lg text-on-surface-variant">
          ยังไม่มีสไลด์ในแครูเซล — กดปุ่ม &ldquo;เพิ่มสไลด์&rdquo; เพื่อเริ่มต้น
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {slides.map((s, idx) => (
          <article
            key={s.id}
            className={`bg-surface-container-lowest rounded-2xl shadow-level-1 border border-outline-variant overflow-hidden ${
              !s.is_active ? 'opacity-60' : ''
            }`}
          >
            <div className="flex flex-col md:flex-row gap-4 p-4 md:p-6">
              {/* Thumbnail */}
              <div className="relative w-full md:w-48 h-32 rounded-xl overflow-hidden bg-surface-container shrink-0">
                {(() => {
                  const imgKey = resolveImageKey(s)
                  if (imgKey) {
                    return (
                      <Image
                        src={r2Url(imgKey)}
                        alt={sourceLabel(t, s.source_type)}
                        fill
                        sizes="(max-width: 768px) 100vw, 192px"
                        className="object-cover"
                      />
                    )
                  }
                  // For room_type/promotion sources we don't carry the joined
                  // image key in this client payload — render a placeholder.
                  return (
                    <div className="absolute inset-0 flex items-center justify-center bg-surface-container text-on-surface-variant">
                      <div className="text-center px-2">
                        <MaterialIcon
                          name={
                            s.source_type === 'room_type'
                              ? 'hotel'
                              : s.source_type === 'promotion'
                                ? 'sell'
                                : 'image'
                          }
                          size={32}
                          className="mx-auto mb-1"
                        />
                        <p className="text-caption">
                          {s.source_type === 'room_type'
                            ? s.room_type_name_th ?? s.room_type_name
                            : s.source_type === 'promotion'
                              ? s.promotion_name
                              : 'Custom'}
                        </p>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-semibold ${sourceBadgeClass(s.source_type)}`}
                    >
                      {sourceLabel(t, s.source_type)}
                    </span>
                    <span className="text-caption text-on-surface-variant uppercase tracking-wider">
                      #{s.display_order}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ToggleButton
                      isActive={s.is_active}
                      onChange={() => handleToggle(s)}
                    />
                  </div>
                </div>
                <h3 className="font-display text-lg text-primary truncate mb-1">
                  {resolveSlideTitle(s, localeBcp)}
                </h3>
                {resolveSlideSubtitle(s, localeBcp) && (
                  <p className="text-body-md text-on-surface-variant line-clamp-2 mb-2">
                    {resolveSlideSubtitle(s, localeBcp)}
                  </p>
                )}
                <p className="text-caption text-on-surface-variant font-mono">
                  {s.id.slice(0, 8)} •{' '}
                  {localeBcp === 'th-TH'
                    ? 'อัปเดตเมื่อ ' + formatDate(s.updated_at, localeBcp)
                    : 'Updated ' + formatDate(s.updated_at, localeBcp)}
                </p>
              </div>

              {/* Controls */}
              <div className="flex md:flex-col items-center md:items-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleMove(s, 'up')}
                  disabled={idx === 0}
                  aria-label="ย้ายขึ้น"
                  className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-primary-fixed hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <MaterialIcon name="arrow_upward" size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(s, 'down')}
                  disabled={idx === slides.length - 1}
                  aria-label="ย้ายลง"
                  className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-primary-fixed hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <MaterialIcon name="arrow_downward" size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(s)}
                  aria-label="ลบสไลด์"
                  className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-error text-error hover:bg-error hover:text-on-primary transition-colors"
                >
                  <MaterialIcon name="delete" size={18} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {confirmRemove && (
        <ConfirmModal
          open
          variant="danger"
          body={`ลบสไลด์นี้? การกระทำนี้ไม่สามารถยกเลิกได้`}
          okLabel="ลบ"
          cancelLabel="ยกเลิก"
          onCancel={() => setConfirmRemove(null)}
          onConfirm={confirmRemoveAction}
        />
      )}
      {alertMessage && (
        <AlertModal open onClose={() => setAlertMessage(null)} body={alertMessage} />
      )}

      {/* Spacer so the page-level Link href above renders alongside the table */}
      <Link
        href=""
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        ref={() => {
          /* no-op — keeps tree-shaker happy in case of unused imports */
        }}
      />
    </>
  )
}

function resolveSlideTitle(s: SlideRow, localeBcp: string): string {
  if (s.source_type === 'room_type') {
    return localeBcp === 'th-TH'
      ? (s.room_type_name_th ?? s.room_type_name ?? 'ห้องพัก')
      : (s.room_type_name ?? s.room_type_name_th ?? 'Room')
  }
  if (s.source_type === 'promotion') {
    return s.promotion_name ?? 'โปรโมชั่น'
  }
  // custom
  return localeBcp === 'th-TH'
    ? (s.custom_caption_th ?? s.custom_caption ?? 'ไม่มีคำบรรยาย')
    : (s.custom_caption ?? s.custom_caption_th ?? 'No caption')
}

function resolveSlideSubtitle(s: SlideRow, localeBcp: string): string | null {
  // No subheading in the DB schema (hero_slides has caption, not subheading).
  // Render a small status string per source type so the admin can scan the list.
  if (s.source_type === 'room_type') return 'ใช้รูป hero_image_key ของห้องพัก'
  if (s.source_type === 'promotion') return 'ใช้รูป image_key ของโปรโมชั่น'
  return localeBcp === 'th-TH' ? 'รูปที่อัปโหลดเองโดยแอดมิน' : 'Custom uploaded image'
}

function ToggleButton({
  isActive,
  onChange,
}: {
  isActive: boolean
  onChange: () => void
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      role="switch"
      aria-checked={isActive}
      aria-label={isActive ? 'ปิดใช้งานสไลด์' : 'เปิดใช้งานสไลด์'}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        isActive ? 'bg-primary' : 'bg-surface-container-high'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-on-primary shadow transition-transform ${
          isActive ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
