import { signOut } from '@/app/actions/auth'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { AvatarUploader } from './AvatarUploader'
import type { AccountProfile } from '@/lib/data/types'

interface ProfileCardProps {
  profile: AccountProfile
}

/**
 * Server component — left-column profile card on /account/profile.
 *
 * Wraps the avatar + name + member-since + sign-out button. The
 * interactive avatar upload is delegated to <AvatarUploader> (a client
 * component island) so the rest of the card stays server-rendered.
 */
export function ProfileCard({ profile }: ProfileCardProps) {
  // "สมาชิกตั้งแต่ ต.ค. 2024" mockup format. We use created_at as a
  // year-month source; render as Thai locale abbreviation.
  const memberSince = formatMemberSince(profile.created_at)

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-(--shadow-ambient) border border-surface-container flex flex-col items-center text-center">
      <div className="w-full p-gutter md:p-[32px] flex flex-col items-center">
        <AvatarUploader
          avatarKey={profile.avatar_key}
          fullName={profile.full_name ?? 'ผู้ใช้'}
        />
        <h2 className="font-headline-sm text-headline-sm text-primary mt-base">
          {profile.full_name ?? 'ผู้ใช้'}
        </h2>
        <p className="text-on-surface-variant text-caption font-caption mt-1">
          สมาชิกตั้งแต่ {memberSince}
        </p>
      </div>
      <div className="w-full px-gutter md:px-[32px] pb-gutter md:pb-[32px]">
        <form action={signOut}>
          <button
            type="submit"
            className="w-full bg-transparent border border-error text-error px-4 py-2 rounded-full font-label-md text-label-md hover:bg-error-container transition-colors flex items-center justify-center gap-2"
          >
            <MaterialIcon name="logout" size={18} />
            ออกจากระบบ
          </button>
        </form>
      </div>
    </div>
  )
}

/** Render `created_at` as "MMM YYYY" in Thai — mirrors the mockup label. */
function formatMemberSince(iso: string): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('th-TH', { month: 'short', year: 'numeric' })
  } catch {
    return '—'
  }
}