import { getHotelSettings } from '@/lib/data/manager'
import { HotelSettingsForm } from '@/components/admin/HotelSettingsForm'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const t = getT(await getLocale())
  const settings = await getHotelSettings()

  return (
    <div className="p-8 lg:p-12 max-w-4xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">{t('admin.settingsPage.title')}</h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            {t('admin.settingsPage.subtitle')}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 bg-secondary-container text-on-secondary-container rounded-full px-4 py-2">
          <MaterialIcon name="admin_panel_settings" size={18} />
          <span className="text-body-md">{t('admin.settingsPage.editMode')}</span>
        </div>
      </header>

      <section>
        <HotelSettingsForm settings={settings} />
      </section>
    </div>
  )
}
