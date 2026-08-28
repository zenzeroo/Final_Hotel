import { getHotelSettings, listCancellationPolicies } from '@/lib/data/manager'
import { getSession } from '@/lib/supabase/getSession'
import { KpiCard } from '@/components/manager/KpiCard'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export const dynamic = 'force-dynamic'

export default async function ManagerSettingsPage() {
  const [settings, policies, session] = await Promise.all([
    getHotelSettings(),
    listCancellationPolicies(),
    getSession(),
  ])

  const isAdmin = session?.role === 'admin'
  const taxPercent = (settings.tax_rate * 100).toFixed(1)
  const resortFeeLabel = `${settings.resort_fee.toLocaleString('th-TH')} ${settings.currency}`

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">ตั้งค่าโรงแรม</h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            ข้อมูลโรงแรม นโยบาย และภาษี — ตั้งค่าได้ผ่าน Admin เท่านั้น
          </p>
        </div>
        <div className="inline-flex items-center gap-2 bg-surface-container-low rounded-full px-4 py-2">
          <MaterialIcon
            name={isAdmin ? 'admin_panel_settings' : 'visibility'}
            size={18}
            className="text-on-surface-variant"
          />
          <span className="text-body-md text-on-surface-variant">
            {isAdmin ? 'โหมดแก้ไข (Admin)' : 'โหมดอ่านอย่างเดียว'}
          </span>
        </div>
      </header>

      {/* 4-col KPI strip */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        <KpiCard label="อัตราภาษี" icon="percent" tone="gold">
          <p className="font-display-lg text-display-lg-mobile text-on-secondary-container">
            {taxPercent}%
          </p>
          <p className="text-caption text-on-secondary-container mt-2">
            ภาษีที่เรียกเก็บจากค่าห้องพัก
          </p>
        </KpiCard>

        <KpiCard label="ค่าบริการรีสอร์ท" icon="receipt_long">
          <p className="font-display-lg text-display-lg-mobile text-primary">
            {resortFeeLabel}
          </p>
          <p className="text-caption text-on-surface-variant mt-2">ต่อคืน ต่อห้อง</p>
        </KpiCard>

        <KpiCard label="เช็คอิน" icon="login">
          <p className="font-display-lg text-display-lg-mobile text-primary">
            {settings.check_in_time}
          </p>
          <p className="text-caption text-on-surface-variant mt-2">เวลาเข้าห้องพัก</p>
        </KpiCard>

        <KpiCard label="เช็คเอาท์" icon="logout">
          <p className="font-display-lg text-display-lg-mobile text-primary">
            {settings.check_out_time}
          </p>
          <p className="text-caption text-on-surface-variant mt-2">เวลาออกจากห้องพัก</p>
        </KpiCard>
      </section>

      {/* Hotel Information */}
      <section className="mb-8">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          ข้อมูลโรงแรม
        </h2>
        <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <dt className="text-label-md uppercase tracking-wider text-on-surface-variant">
                ชื่อโรงแรม (TH/EN)
              </dt>
              <dd className="text-body-lg text-primary mt-1">
                {settings.name_th ?? settings.name}
                {settings.name_th && (
                  <span className="text-body-md text-on-surface-variant ml-2">
                    ({settings.name})
                  </span>
                )}
              </dd>
            </div>

            <div>
              <dt className="text-label-md uppercase tracking-wider text-on-surface-variant">
                เบอร์โทรศัพท์
              </dt>
              <dd className="text-body-lg text-primary mt-1">{settings.phone}</dd>
            </div>

            <div className="md:col-span-2">
              <dt className="text-label-md uppercase tracking-wider text-on-surface-variant">
                ที่อยู่
              </dt>
              <dd className="text-body-md text-on-surface mt-1">{settings.address}</dd>
            </div>

            <div>
              <dt className="text-label-md uppercase tracking-wider text-on-surface-variant">
                อีเมล
              </dt>
              <dd className="text-body-md text-primary mt-1">{settings.email}</dd>
            </div>

            <div>
              <dt className="text-label-md uppercase tracking-wider text-on-surface-variant">
                สกุลเงิน
              </dt>
              <dd className="text-body-md text-primary mt-1">{settings.currency}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Cancellation Policies */}
      <section className="mb-8">
        <h2 className="font-headline-sm text-headline-sm text-primary mb-4">
          นโยบายการยกเลิก
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className="bg-surface-container-lowest rounded-lg shadow-level-1 p-5 border border-outline-variant"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-headline-xs text-headline-xs text-primary">
                  {policy.name}
                </h3>
                <MaterialIcon
                  name={
                    policy.refund_pct === 100
                      ? 'verified'
                      : policy.refund_pct === 50
                      ? 'schedule'
                      : 'block'
                  }
                  size={20}
                  className="text-secondary"
                />
              </div>
              <div className="space-y-2 text-body-md">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">ยกเลิกฟรีก่อน</span>
                  <span className="text-primary font-medium">
                    {policy.free_cancel_hours} ชม.
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">คืนเงิน</span>
                  <span className="text-primary font-medium">{policy.refund_pct}%</span>
                </div>
              </div>
              <p className="text-caption text-on-surface-variant mt-4 pt-3 border-t border-outline-variant">
                {policy.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <p className="text-caption text-on-surface-variant text-center mt-12">
        อัปเดตล่าสุดเมื่อ {new Date(settings.updated_at).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })}
      </p>
    </div>
  )
}
