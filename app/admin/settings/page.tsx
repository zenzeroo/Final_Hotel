import { getHotelSettings } from '@/lib/data/manager'
import { HotelSettingsForm } from '@/components/admin/HotelSettingsForm'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const settings = await getHotelSettings()

  return (
    <div className="p-8 lg:p-12 max-w-4xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">ตั้งค่าโรงแรม</h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            ตั้งค่าข้อมูลโรงแรม ภาษี ค่าธรรมเนียม และเวลาเช็คอิน/เอาท์
          </p>
        </div>
        <div className="inline-flex items-center gap-2 bg-secondary-container text-on-secondary-container rounded-full px-4 py-2">
          <MaterialIcon name="admin_panel_settings" size={18} />
          <span className="text-body-md">โหมดแก้ไข</span>
        </div>
      </header>

      <section>
        <HotelSettingsForm settings={settings} />
      </section>
    </div>
  )
}
