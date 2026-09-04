import type { Metadata } from 'next'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'ร่วมงานกับเรา — Zenzero Hotel',
  description: 'ตำแหน่งงานว่างและโอกาสร่วมงานกับ Zenzero Hotel',
}

export default function CareersPage() {
  return (
    <>
      <TopNavBar />
      <main className="flex-1 bg-background">
        <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-16 md:py-24">
          <div className="max-w-3xl">
            <span className="text-label-md text-primary font-semibold uppercase tracking-wider">
              อาชีพ
            </span>
            <h1 className="font-display text-3xl md:text-4xl text-on-surface mt-2 mb-8">
              ร่วมงานกับเรา
            </h1>

            <p className="text-body-lg text-on-surface mb-10">
              Zenzero Hotel ยินดีต้อนรับผู้ที่มีใจรักงานบริการและต้องการเติบโตในอุตสาหกรรมโรงแรม
              เรามองหาคนที่เชื่อในค่านิยมเดียวกัน — จริงใจ สะอาด ใส่ใจ และยั่งยืน
            </p>

            <section className="mb-10">
              <h2 className="font-display text-xl text-on-surface mb-4">
                สวัสดิการ
              </h2>
              <ul className="list-disc list-inside space-y-2 text-body-md text-on-surface-variant">
                <li>เงินเดือนตามโครงสร้าง + ค่าล่วงเวลา</li>
                <li>ประกันสังคม + กองทุนสำรองเลี้ยงชีพ</li>
                <li>วันหยุดพักร้อนประจำปี</li>
                <li>ส่วนลดค่าห้องพักสำหรับพนักงานและครอบครัว</li>
                <li>โอกาสฝึกอบรมและพัฒนาทักษะ</li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="font-display text-xl text-on-surface mb-4">
                ตำแหน่งที่เปิดรับ
              </h2>
              <div className="space-y-3">
                <PositionRow title="พนักงานต้อนรับ (Reception)" type="Full-time" />
                <PositionRow title="พนักงานแม่บ้าน (Housekeeping)" type="Full-time / Part-time" />
                <PositionRow title="พนักงานรักษาความปลอดภัย" type="Full-time" />
                <PositionRow title="พนักงานซ่อมบำรุง (Maintenance)" type="Full-time" />
              </div>
            </section>

            <section className="bg-surface-container-low rounded-2xl p-8 border border-outline-variant">
              <h2 className="font-display text-xl text-on-surface mb-3">
                ส่งใบสมัคร
              </h2>
              <p className="text-body-md text-on-surface-variant mb-4">
                ส่งประวัติและจดหมายสมัครงานมาที่อีเมลด้านล่าง ระบุตำแหน่งที่สนใจ
                ทีมงาน HR จะติดต่อกลับภายใน 7 วันทำการ
              </p>
              <a
                href="mailto:careers@zenzero.com?subject=สมัครงาน%20Zenzero%20Hotel"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-secondary font-semibold text-label-md uppercase tracking-wider hover:bg-primary-container transition-colors"
              >
                careers@zenzero.com
              </a>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

function PositionRow({ title, type }: { title: string; type: string }) {
  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-outline-variant last:border-b-0">
      <span className="text-body-md text-on-surface">{title}</span>
      <span className="text-caption text-on-surface-variant bg-surface-container px-3 py-1 rounded-full">
        {type}
      </span>
    </div>
  )
}
