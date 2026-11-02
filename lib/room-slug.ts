/**
 * Internal slug for a room created in admin. Admins no longer type one: it
 * only names the room's image folder in R2 and must be unique, so it is built
 * from the room number plus a random suffix ("room-p-01-a1b2c3").
 */
export function roomSlugFor(unitLabel: string, suffix: string): string {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  return ['room', clean(unitLabel), clean(suffix)].filter(Boolean).join('-')
}
