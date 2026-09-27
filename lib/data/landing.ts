import { createClient } from '@/lib/supabase/server'
import type { ResolvedHeroSlide, HeroSlideSourceType } from './types'

/**
 * Phase 43 — Public hero carousel data loader.
 *
 * Reads active hero_slides ordered by display_order + resolves the
 * associated source (room_type or promotion) into display-ready fields
 * (heading, subheading, badge) so the homepage carousel component can
 * render without N+1 follow-up queries.
 *
 * For `custom` slides the heading/subheading come from `custom_caption_th`
 * / `custom_caption` columns directly (admin enters the text).
 *
 * RLS: anon users see only `is_active = true` rows via the public read
 * policy. RLS also handles this filter server-side so the JS-side `.eq`
 * is defense-in-depth.
 *
 * Returns an empty array if no active slides exist — caller can fall back
 * to the static HeroSection.
 */
export async function getActiveHeroSlides(): Promise<ResolvedHeroSlide[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('hero_slides')
    .select(
      `
      id, source_type, display_order, is_active,
      custom_image_key, custom_caption, custom_caption_th,
      room_type:room_types(id, hero_image_key, name, name_th, short_desc, short_desc_th),
      promotion:promotions(id, name, description, image_key)
    `,
    )
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (error) return [] // graceful fallback

  /**
   * Normalize PostgREST's "single FK" response — Supabase types infer the
   * shape as either a single object OR an array of one depending on the
   * schema detector's mood. Both `null` and missing both indicate "no row".
   */
  function firstOrNull<T>(v: T | T[] | null | undefined): T | null {
    if (v == null) return null
    if (Array.isArray(v)) return v[0] ?? null
    return v
  }

  const resolved: ResolvedHeroSlide[] = []
  for (const row of data ?? []) {
    // Cast through `unknown` first — PostgREST infers the relation shape
    // (single object vs array) from the FK cardinality, but the typed
    // supabase-js result here uses an array shape even for single FK.
    // See lib/data/supabase-manager.ts listAllHeroSlides for the same pattern.
    const r = row as unknown as {
      id: string
      source_type: HeroSlideSourceType
      display_order: number
      is_active: boolean
      custom_image_key: string | null
      custom_caption: string | null
      custom_caption_th: string | null
      room_type:
        | {
            id: string
            hero_image_key: string
            name: string
            name_th: string
            short_desc: string | null
            short_desc_th: string | null
          }
        | {
            id: string
            hero_image_key: string
            name: string
            name_th: string
            short_desc: string | null
            short_desc_th: string | null
          }[]
        | null
      promotion:
        | {
            id: string
            name: string
            description: string | null
            image_key: string | null
          }
        | {
            id: string
            name: string
            description: string | null
            image_key: string | null
          }[]
        | null
    }

    const rt = firstOrNull(r.room_type)
    const pr = firstOrNull(r.promotion)

    let imageKey: string | null = null
    let heading: string | null = null
    let subheading: string | null = null
    let badge: string | null = null

    if (r.source_type === 'room_type' && rt) {
      imageKey = rt.hero_image_key
      heading = rt.name_th ?? rt.name
      subheading = rt.short_desc_th ?? rt.short_desc
    } else if (r.source_type === 'promotion' && pr) {
      imageKey = pr.image_key
      heading = pr.name
      subheading = pr.description
      badge = 'โปรโมชั่น' // Phase 43 — small badge to signal promo context
    } else if (r.source_type === 'custom') {
      imageKey = r.custom_image_key
      heading = r.custom_caption_th ?? r.custom_caption
      // custom slides have no subheading — keep search focus.
    }

    // Skip slides with no usable image (e.g. legacy custom row where the
    // R2 file was deleted). Surface a console warning in dev so admins
    // notice without breaking the homepage.
    if (!imageKey) continue

    resolved.push({
      id: r.id,
      imageKey,
      sourceType: r.source_type,
      displayOrder: r.display_order,
      isActive: r.is_active,
      heading,
      subheading,
      badge,
    })
  }

  return resolved
}
