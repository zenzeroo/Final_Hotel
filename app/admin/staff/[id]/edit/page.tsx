import Link from 'next/link'
import { notFound } from 'next/navigation'
import { listStaff } from '@/lib/data/manager'
import { getSession } from '@/lib/supabase/getSession'
import { StaffForm } from '@/components/admin/StaffForm'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

export default async function EditStaffPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const t = getT(await getLocale())
  const { id } = await params
  const [session, staff] = await Promise.all([getSession(), listStaff()])
  const member = staff.find((s) => s.id === id)
  if (!member) notFound()

  const isSelf = member.id === session?.id

  return (
    <div className="p-8 lg:p-12 max-w-3xl">
      <Link
        href="/admin/staff"
        className="inline-flex items-center gap-2 px-2 py-1 rounded text-body-md text-primary hover:bg-primary-fixed hover:text-primary mb-4"
      >
        <MaterialIcon name="arrow_back" size={18} />
        {t('admin.staffPage.backToList')}
      </Link>

      <header className="mb-8">
        <h1 className="font-headline-md text-headline-md text-primary">
          {t('admin.staffPage.editHeading', { name: member.full_name })}
        </h1>
        <p className="text-body-lg text-on-surface-variant mt-2">{member.email}</p>
      </header>

      <StaffForm staff={member} isSelf={isSelf} />
    </div>
  )
}
