import type { AccountProfile } from '@/lib/data/types'
import type { UserRole } from '@/lib/supabase/roles'
import { ProfileCard } from './ProfileCard'
import { AccountQuickLinks, type QuickLink } from './AccountQuickLinks'
import { PersonalInfoForm } from './PersonalInfoForm'
import { ChangePasswordForm } from './ChangePasswordForm'
import { DeactivateAccountSection } from './DeactivateAccountSection'

export interface AccountProfileContentProps {
  profile: AccountProfile
  /**
   * Current viewer's role. Defaults to `'user'` for back-compat with
   * existing callers (User profile page doesn't pass role → editable).
   * Staff pages pass their role so PersonalInfoForm locks name + birthdate.
   */
  role?: UserRole | 'user'
  /**
   * Show the "ลบบัญชี" danger zone (User only — staff can't self-deactivate;
   * admin controls `is_active` via /admin/staff).
   * @default false
   */
  showDangerZone?: boolean
  /**
   * Quick links shown in the left column under the profile card.
   * Empty array (or omitted) hides the quick-links card entirely.
   */
  quickLinks?: readonly QuickLink[]
}

/**
 * Shared 4-card profile composition used by both User (`/account/profile`)
 * and staff (`/{role}/profile`). Owns no chrome — the page wrappers add
 * their own header + (for User only) `TopNavBar` / `Footer` shell.
 *
 * Layout: left column = profile card + quick links; right column = personal
 * info (view + edit), change password, optional danger zone.
 */
export function AccountProfileContent({
  profile,
  role = 'user',
  showDangerZone = false,
  quickLinks = [],
}: AccountProfileContentProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter items-start">
      {/* Left column */}
      <div className="lg:col-span-1 flex flex-col gap-gutter">
        <ProfileCard profile={profile} />
        <AccountQuickLinks links={quickLinks} />
      </div>

      {/* Right column */}
      <div className="lg:col-span-2 flex flex-col gap-gutter">
        <PersonalInfoForm profile={profile} role={role} />
        <ChangePasswordForm />
        {showDangerZone && (
          <DeactivateAccountSection fullName={profile.full_name} />
        )}
      </div>
    </div>
  )
}
