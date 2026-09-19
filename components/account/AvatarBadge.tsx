import { r2Url } from '@/lib/r2/publicUrl'

interface AvatarBadgeProps {
  avatarKey: string | null
  fullName: string
  /** Diameter in px. Default 20 (compact — fits inline with text links). */
  size?: number
  className?: string
}

/**
 * Read-only avatar circle used in places like the staff sidebar profile link.
 *
 * Renders the uploaded avatar image when `avatarKey` is set; falls back to
 * 2-character initials when not (no broken `<img>` tag, no extra network
 * round-trip). For the full upload UI (with camera-button overlay), use
 * `<AvatarUploader>` from the profile page instead.
 *
 * Server Component — `<img>` works fine without `'use client'`.
 */
export function AvatarBadge({
  avatarKey,
  fullName,
  size = 20,
  className = '',
}: AvatarBadgeProps) {
  const url = r2Url(avatarKey)
  return (
    <div
      className={`relative shrink-0 rounded-full overflow-hidden bg-primary text-secondary border border-primary-container ${className}`}
      style={{ width: size, height: size }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`รูปโปรไฟล์ของ ${fullName}`}
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className="w-full h-full inline-flex items-center justify-center font-semibold"
          style={{ fontSize: size * 0.42 }}
          aria-hidden
        >
          {initials(fullName)}
        </div>
      )}
    </div>
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}
