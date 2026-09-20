import { requireRole } from '@/lib/auth/require'
import { getOwnProfile } from '@/lib/data/supabase-account'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'
import { AccountProfileContent } from '@/components/account/AccountProfileContent'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

// Server-render on demand (Supabase data + session-scoped).
export const dynamic = 'force-dynamic'

export default async function AccountProfilePage(props: {
  searchParams: Promise<{ linked?: string; link_error?: string }>
}) {
  // Layout already gated role/user + auth; this is defense-in-depth.
  await requireRole('user', '/account/profile')

  const searchParams = await props.searchParams
  const profile = await getOwnProfile()
  const t = getT(await getLocale())

  if (!profile) {
    return (
      <>
        <TopNavBar />
        <main className="flex-1 bg-background">
          <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-section-gap text-center">
            <h1 className="font-headline-md text-headline-md text-primary mb-base">
              {t('profile.title')}
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
              {t('profile.title')}
            </h1>
            <p className="text-on-surface-variant text-body-lg">
              {t('profile.subtitle')}
            </p>
          </div>

          <AccountProfileContent
            profile={profile}
            showDangerZone
            quickLinks={[
              { href: '/bookings', icon: 'history', label: 'ประวัติการจอง' },
            ]}
            searchParams={Promise.resolve(searchParams)}
          />
        </div>
      </main>
      <Footer />
    </>
  )
}
