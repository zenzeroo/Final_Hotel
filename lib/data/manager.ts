/**
 * Manager / Admin data layer — thin re-export of the Supabase implementation,
 * plus the `getPricingConstants` helper that derives a `PricingSettings`
 * shape from `getHotelSettings()`.
 *
 * The mock layer was deleted; all functions hit real DB.
 */
export * from './supabase-manager'
import { DEFAULT_PRICING, type PricingSettings } from '@/lib/pricing'
import { getHotelSettings } from './supabase-manager'

/**
 * Read pricing constants from `hotel_settings` and shape them as a
 * `PricingSettings` object suitable for `calculatePrice(settings)`.
 * Falls back to `DEFAULT_PRICING` (0.07 tax / 150 THB resort fee) when
 * the singleton row is missing or the columns are null.
 *
 * Used by every server-action caller of `calculatePrice` so the admin
 * `tax_rate` / `resort_fee` overrides actually reach the booking insert.
 */
export async function getPricingConstants(): Promise<PricingSettings> {
  const settings = await getHotelSettings()
  if (!settings) return DEFAULT_PRICING
  return {
    taxRate: Number(settings.tax_rate ?? DEFAULT_PRICING.taxRate),
    resortFeePerNight: Number(settings.resort_fee ?? DEFAULT_PRICING.resortFeePerNight),
  }
}