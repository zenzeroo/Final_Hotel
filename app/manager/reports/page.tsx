import { getReportsData } from '@/lib/data/manager'
import { RevenueLineChart } from '@/components/manager/RevenueLineChart'
import { OccupancyBarChart } from '@/components/manager/OccupancyBarChart'
import { HorizontalBarChart } from '@/components/manager/HorizontalBarChart'
import { ChannelsDonutChart } from '@/components/manager/ChannelsDonutChart'
import { CancellationStatCard } from '@/components/manager/CancellationStatCard'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export const dynamic = 'force-dynamic'

export default async function ManagerReportsPage() {
  const data = await getReportsData()

  return (
    <div className="p-8 lg:p-12 max-w-7xl">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary">
            รายงานและการวิเคราะห์
          </h1>
          <p className="text-body-lg text-on-surface-variant mt-2">
            ภาพรวมผลงาน · 7 วันล่าสุด และเทียบปีก่อน
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-outline text-body-md text-primary hover:bg-surface-container-low"
          >
            <MaterialIcon name="picture_as_pdf" size={18} />
            ส่งออก PDF
          </button>
          <a
            href="/api/manager/reports/export"
            download
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-secondary text-body-md font-semibold"
          >
            <MaterialIcon name="table_view" size={18} />
            ส่งออก Excel
          </a>
        </div>
      </header>

      <section className="mb-8">
        <RevenueLineChart
          data={data.dailyRevenue}
          total={data.totalRevenue7d}
          trendPct={data.totalRevenueTrendPct}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <OccupancyBarChart data={data.occupancyYoY} />
        </div>
        <CancellationStatCard
          ratePct={data.cancellationRatePct}
          trendPct={data.cancellationTrendPct}
          totalBookings={data.totalBookings7d}
        />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <HorizontalBarChart
          title="ห้องที่ถูกจองมากที่สุด"
          labels={data.mostBookedRooms.map((r) => r.name)}
          values={data.mostBookedRooms.map((r) => r.count)}
          format="count"
          label="การจอง"
        />
        <HorizontalBarChart
          title="ประเภทห้องที่มีรายได้สูงสุด"
          labels={data.highestRevenueRoomTypes.map((r) => r.name)}
          values={data.highestRevenueRoomTypes.map((r) => r.revenue)}
          format="thb"
          label="รายได้"
        />
        <ChannelsDonutChart channels={data.channels} />
      </section>
    </div>
  )
}
