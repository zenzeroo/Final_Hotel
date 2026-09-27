import Link from 'next/link'
import { listAllHeroSlides } from '@/lib/data/manager'
import { HeroSlidesAdminTable } from '@/components/admin/HeroSlidesAdminTable'
import { AddHeroSlideButton } from '@/components/admin/AddHeroSlideButton'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { listRoomTypes } from '@/lib/data/rooms'
import { listPromotions } from '@/lib/data/manager'

export const dynamic = 'force-dynamic'

/**
 * Phase 43 — Admin management page for the homepage hero carousel.
 *
 * Lists all slides (active + inactive) in display_order, with controls
 * for toggle / up / down / remove. The "Add slide" button opens a 3-tab
 * picker (room_type / promotion / custom upload).
 *
 * UI-only cap of 8 active slides — enforced by disabling the add button
 * when activeCount >= 8 (DB has no trigger — admins are trusted).
 *
 * Admin-only — `app/admin/layout.tsx` already enforces role.
 */
export default async function AdminHeroCarouselPage() {
  const locale = await getLocale()
  const t = getT(locale)
  const isEn = locale === 'en'

  const [slides, roomTypes, promotions] = await Promise.all([
    listAllHeroSlides(),
    listRoomTypes({ isActive: true, isDeleted: false }),
    listPromotions(),
  ])

  const activeCount = slides.filter((s) => s.is_active).length
  const customCount = slides.filter((s) => s.source_type === 'custom').length
  const roomTypeCount = slides.filter((s) => s.source_type === 'room_type').length
  const promotionCount = slides.filter((s) => s.source_type === 'promotion').length

  // Pre-compute "already used" set for the picker (disable rooms/promos
  // already in a slide — admin can edit the existing slide instead).
  const usedRoomTypeIds = new Set(
    slides.filter((s) => s.room_type_id).map((s) => s.room_type_id!),
  )
  const usedPromotionIds = new Set(
    slides.filter((s) => s.promotion_id).map((s) => s.promotion_id!),
  )

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            {t('admin.heroCarouselPage.title')}
          </h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            {t('admin.heroCarouselPage.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/"
            target="_blank"
            className="inline-flex items-center gap-2 bg-surface-container-low rounded-lg px-4 py-2 hover:bg-surface-container transition-colors"
          >
            <MaterialIcon name="open_in_new" size={18} />
            <span className="text-body-md">{t('admin.heroCarouselPage.viewHomepage')}</span>
          </Link>
          <AddHeroSlideButton
            disabled={activeCount >= 8}
            roomTypes={roomTypes
              .filter((r) => r.hero_image_key)
              .map((r) => ({
                id: r.id,
                name: r.name_th ?? r.name,
                heroImageKey: r.hero_image_key!,
              }))}
            promotions={promotions
              .filter((p) => p.is_active && p.image_key)
              .map((p) => ({
                id: p.id,
                name: p.name,
                imageKey: p.image_key!,
              }))}
            usedRoomTypeIds={[...usedRoomTypeIds]}
            usedPromotionIds={[...usedPromotionIds]}
          />
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiTile
          label={t('admin.heroCarouselPage.kpiActive')}
          value={activeCount}
          suffix="/ 8"
        />
        <KpiTile
          label={t('admin.heroCarouselPage.kpiRoomType')}
          value={roomTypeCount}
        />
        <KpiTile
          label={t('admin.heroCarouselPage.kpiPromotion')}
          value={promotionCount}
        />
        <KpiTile
          label={t('admin.heroCarouselPage.kpiCustom')}
          value={customCount}
        />
      </section>

      <section>
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          {t('admin.heroCarouselPage.slidesTitle')}
        </h2>
        <HeroSlidesAdminTable slides={slides} locale={isEn ? 'en' : 'th'} />
      </section>
    </div>
  )
}

function KpiTile({
  label,
  value,
  suffix,
}: {
  label: string
  value: number
  suffix?: string
}) {
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
      <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
        {label}
      </p>
      <p className="font-display-lg text-display-lg-mobile text-primary">
        {value}
        {suffix && <span className="text-body-md text-on-surface-variant ml-1">{suffix}</span>}
      </p>
    </div>
  )
}
