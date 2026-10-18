'use client'

import { signOut } from '@/app/actions/auth'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { AvatarUploader } from './AvatarUploader'
import type { AccountProfile } from '@/lib/data/types'
import { formatDate } from '@/lib/dates'
import { useLocale } from '@/lib/i18n/useT'
import { LOCALE_BCP47 } from '@/lib/i18n/config'
import { useT } from '@/lib/i18n/useT'

interface ProfileCardProps {
  profile: AccountProfile
}

/**
 * Client component (needs useT) — left-column profile card on /account/profile.
 *
 * Wraps the avatar + name + member-since + sign-out button. The
 * interactive avatar upload is delegated to <AvatarUploader> (a client
 * component island) so the rest of the card stays server-rendered.
 */
export function ProfileCard({ profile }: ProfileCardProps) {
  const t = useT()
  const locale = useLocale()
  const memberSince = formatMemberSince(profile.created_at, LOCALE_BCP47[locale])

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-(--shadow-ambient) border border-surface-container flex flex-col items-center text-center">
      <div className="w-full p-gutter md:p-[32px] flex flex-col items-center">
        <AvatarUploader
          avatarKey={profile.avatar_key}
          fullName={profile.full_name ?? t('profile.userFallback')}
        />
        <h2 className="font-headline-sm text-headline-sm text-primary mt-base">
          {profile.full_name ?? t('profile.userFallback')}
        </h2>
        <p className="text-on-surface-variant text-caption font-caption mt-1">
          {t('profile.memberSinceDate', { date: memberSince })}
        </p>
      </div>
      <div className="w-full px-gutter md:px-[32px] pb-gutter md:pb-[32px]">
        <form action={signOut}>
          <button
            type="submit"
            className="w-full bg-transparent border border-error text-error px-4 py-2 rounded-full font-label-md text-label-md hover:bg-error-container transition-colors flex items-center justify-center gap-2"
          >
            <MaterialIcon name="logout" size={18} />
            {t('profile.signOut')}
          </button>
        </form>
      </div>
    </div>
  )
}

/** Render `created_at` as a date in the active locale. */
function formatMemberSince(iso: string, bcp: string): string {
  if (!iso) return '—'
  try {
    return formatDate(iso, bcp)
  } catch {
    return '—'
  }
}