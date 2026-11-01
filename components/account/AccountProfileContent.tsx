import type { AccountProfile } from '@/lib/data/types'
import type { UserRole } from '@/lib/supabase/roles'
import { ProfileCard } from './ProfileCard'
import { AccountQuickLinks, type QuickLink } from './AccountQuickLinks'
import { PersonalInfoForm } from './PersonalInfoForm'
import { AccountSecuritySection } from './AccountSecuritySection'
import { LinkedAccountsCard } from './LinkedAccountsCard'
import { PrivacyConsentCard } from './PrivacyConsentCard'

export interface AccountProfileContentProps {
  profile: AccountProfile
  /**
   * Current viewer's role. Defaults to `'user'` for back-compat with
   * existing callers (User profile page doesn't pass role → editable).
   * Staff pages pass their role so PersonalInfoForm locks name + birthdate.
   */
  role?: UserRole | 'user'
  /**
   * Quick links shown in the left column under the profile card.
   * Empty array (or omitted) hides the quick-links card entirely.
   */
  quickLinks?: readonly QuickLink[]
  /**
   * Phase 37 — passed to LinkedAccountsCard so it can read `?linked=...`
   * flash-banner query params. Server component receives this via
   * page.tsx `searchParams` prop.
   */
  searchParams?: Promise<{ linked?: string; link_error?: string }>
}

/**
 * Shared profile composition used by both User (`/account/profile`)
 * and staff (`/{role}/profile`). Owns no chrome — the page wrappers add
 * their own header + (for User only) `TopNavBar` / `Footer` shell.
 *
 * Phase 37 — added `LinkedAccountsCard` ("วิธีเข้าสู่ระบบ") in the left
 * column underneath the profile card so users can manage multi-provider
 * sign-in (email/password + Google).
 *
 * Phase 38 — removed the User-account self-delete (Danger Zone) section
 * that lived here in Phase 26–37. Admin staff `setStaffActive` still
 * flips `profiles.is_active` via `/admin/staff`; only the User-side
 * self-delete path was removed.
 *
 * Layout (4:8): left column = profile card + quick links, sticky on wide
 * screens so it stays beside the longer right column; right column = personal
 * info, then sign-in (password, linked accounts), then PDPA consent.
 */
export async function AccountProfileContent({
  profile,
  role = 'user',
  quickLinks = [],
  searchParams,
}: AccountProfileContentProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] gap-gutter lg:gap-10 items-start">
      {/* Left column */}
      <div className="flex flex-col gap-gutter lg:sticky lg:top-24">
        <ProfileCard profile={profile} />
        <AccountQuickLinks links={quickLinks} />
      </div>

      {/* Right column */}
      <div className="flex flex-col gap-gutter">
        <PersonalInfoForm profile={profile} role={role} />
        <AccountSecuritySection />
        {searchParams && <LinkedAccountsCard searchParams={searchParams} />}
        {/* Phase 61 — PDPA consent; customers only (staff are not asked). */}
        {role === 'user' && <PrivacyConsentCard profile={profile} />}
      </div>
    </div>
  )
}
