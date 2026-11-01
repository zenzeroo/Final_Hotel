import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth/require'
import { getOwnProfile } from '@/lib/data/supabase-account'
import { AccountProfileContent } from '@/components/account/AccountProfileContent'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

export default async function ManagerProfilePage() {
  await requireRole('manager', '/manager/profile')
  const profile = await getOwnProfile()
  if (!profile) notFound()
  const t = getT(await getLocale())

  return (
    <div className="px-4 py-6 md:p-8 lg:p-12">
      <header className="mb-6">
        <h1 className="font-display text-2xl md:text-[28px] leading-[1.25] text-primary">
          {t('staff.profilePage.title')}
        </h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          {t('staff.profilePage.subtitle')}
        </p>
      </header>
      <AccountProfileContent
        profile={profile}
        role="manager"
        quickLinks={[
          { href: '/manager', icon: 'dashboard', label: t('staff.profilePage.linkDashboard') },
          { href: '/manager/reports', icon: 'analytics', label: t('staff.profilePage.linkReports') },
        ]}
      />
    </div>
  )
}
