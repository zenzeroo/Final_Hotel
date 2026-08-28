import { env } from '../env'

/**
 * Build a public R2 URL for a stored object key.
 * @example r2Url('rooms/serenity-suite/hero.webp')
 *   => 'https://pub-bd00e642ff7946b0b63fbec785554bf8.r2.dev/rooms/serenity-suite/hero.webp'
 */
export function r2Url(key: string | null | undefined): string {
  if (!key) return ''
  const base = env.R2_PUBLIC_URL.replace(/\/+$/, '')
  const clean = key.replace(/^\/+/, '')
  return `${base}/${clean}`
}
