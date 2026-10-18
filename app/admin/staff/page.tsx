import { listStaff } from '@/lib/data/manager'
import { getSession } from '@/lib/supabase/getSession'
import { StaffAdminTable } from '@/components/admin/StaffAdminTable'
import { AddStaffModal } from '@/components/admin/AddStaffModal'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

export default async function AdminStaffPage() {
  const t = getT(await getLocale())
  const session = await getSession()
  const staff = await listStaff()

  const activeCount = staff.filter((s) => s.is_active).length
  const adminCount = staff.filter((s) => s.role === 'admin' && s.is_active).length

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">{t('admin.staffPage.heading')}</h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            {t('admin.staffPage.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Phase 33 — Add staff modal trigger (replaces inline AddStaffForm section) */}
          <AddStaffModal />
          <div className="inline-flex items-center gap-2 bg-surface-container-low rounded-full px-4 py-2">
            <MaterialIcon name="badge" size={18} className="text-on-surface-variant" />
            <span className="text-body-md text-on-surface-variant">{t('admin.staffPage.peopleCount', { count: staff.length })}</span>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            {t('admin.staffPage.kpiAll')}
          </p>
          <p className="font-display-lg text-display-lg-mobile text-primary">{staff.length}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            {t('admin.staffPage.kpiActive')}
          </p>
          <p className="font-display-lg text-display-lg-mobile text-secondary">{activeCount}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant mb-2">
            {t('admin.staffPage.kpiAdmins')}
          </p>
          <p className="font-display-lg text-display-lg-mobile text-error">{adminCount}</p>
        </div>
      </section>

      <section>
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">{t('admin.staffPage.listHeading')}</h2>
        <StaffAdminTable staff={staff} currentUserId={session?.id ?? ''} />
      </section>
    </div>
  )
}
