import { requireRole } from '@/lib/auth/require'
import { getOwnProfile } from '@/lib/data/account'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'
import { ProfileCard } from '@/components/account/ProfileCard'
import { AccountQuickLinks } from '@/components/account/AccountQuickLinks'
import { PersonalInfoForm } from '@/components/account/PersonalInfoForm'
import { ChangePasswordForm } from '@/components/account/ChangePasswordForm'
import { DeactivateAccountSection } from '@/components/account/DeactivateAccountSection'

// Server-render on demand (Supabase data + session-scoped).
export const dynamic = 'force-dynamic'

export default async function AccountProfilePage() {
  // Layout already gated role/user + auth; this is defense-in-depth.
  await requireRole('user', '/account/profile')

  const profile = await getOwnProfile()

  if (!profile) {
    return (
      <>
        <TopNavBar />
        <main className="flex-1 bg-background">
          <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-section-gap text-center">
            <h1 className="font-headline-md text-headline-md text-primary mb-base">
              โปรไฟล์ของฉัน
            </h1>
            <p className="text-on-surface-variant text-body-lg">
              ไม่พบข้อมูลโปรไฟล์ของคุณ กรุณาติดต่อผู้ดูแลระบบ
            </p>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <TopNavBar />
      <main className="flex-1 bg-background">
        <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-section-gap">
          <div className="mb-gutter">
            <h1 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-primary mb-base">
              โปรไฟล์ของฉัน
            </h1>
            <p className="text-on-surface-variant text-body-lg">
              จัดการข้อมูลส่วนตัวและการตั้งค่าบัญชีของคุณ
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter items-start">
            {/* Left column */}
            <div className="lg:col-span-1 flex flex-col gap-gutter">
              <ProfileCard profile={profile} />
              <AccountQuickLinks />
            </div>

            {/* Right column */}
            <div className="lg:col-span-2 flex flex-col gap-gutter">
              <PersonalInfoForm profile={profile} />
              <ChangePasswordForm />
              <DeactivateAccountSection fullName={profile.full_name} />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}