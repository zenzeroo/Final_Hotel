import type { Metadata } from 'next'
import Link from 'next/link'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'เกี่ยวกับโรงแรม — Zenzero Hotel',
  description: '�ระวัติ วิสัยทัศน์ และค่านิยมของ Zenzero Hotel',
}

export default function AboutPage() {
  return (
    <>
      <TopNavBar />
      <main className="flex-1 bg-background">
        <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-16 md:py-24">
          <div className="max-w-3xl">
            <span className="text-label-md text-primary font-semibold uppercase tracking-wider">
              เกี่ยวกับเรา
            </span>
            <h1 className="font-display text-3xl md:text-4xl text-on-surface mt-2 mb-8">
              เกี่ยวกับ Zenzero Hotel
            </h1>

            <div className="space-y-6 text-body-md text-on-surface-variant">
              <p className="text-body-lg text-on-surface">
                Zenzero Hotel คือโรงแรมบูติกที่ตั้งอยู่ในทำเลที่สะดวกสบาย
                พร้อมห้องพักหลากหลายประเภทที่ออกแบบมาเพื่อตอบโจทย์ทุกการเดินทาง
                ตั้งแต่ Deluxe ไปจนถึง Suite และ Villa ส่วนตัว
              </p>

              <Section title="วิสัยทัศน์">
                <p>
                  เราเชื่อว่าการเดินทางที่ดีเริ่มต้นจากที่พักที่ดี
                  เรามุ่งมั่นสร้างประสบการณ์การเข้าพักที่อบอุ่น สะดวกสบาย
                  และคุ้มค่าสำหรับผู้เข้าพักทุกท่าน
                </p>
              </Section>

              <Section title="ค่านิยมของเรา">
                <ul className="list-disc list-inside space-y-2">
                  <li><strong>ความจริงใจ</strong> — บริการด้วยใจ ไม่มีค่าใช้จ่ายแอบแฝง</li>
                  <li><strong>ความสะอาด</strong> — ห้องพักสะอาด ผ่านมาตรฐานสากล</li>
                  <li><strong>ความใส่ใจ</strong> — ทีมงานพร้อมดูแลทุกความต้องการ</li>
                  <li><strong>ความยั่งยืน</strong> — ลดการใช้พลาสติก ใช้วัสดุที่เป็นมิตรกับสิ่งแวดล้อม</li>
                </ul>
              </Section>

              <Section title="สิ่งอำนวยความสะดวก">
                <ul className="list-disc list-inside space-y-2">
                  <li>Wi-Fi ความเร็วสูงฟรีทุกห้อง</li>
                  <li>สระว่ายน้ำและฟิตเนส</li>
                  <li>ร้านอาหารและรูมเซอร์วิส</li>
                  <li>ที่จอดรถฟรี</li>
                  <li>แผนกต้อนรับ 24 ชั่วโมง</li>
                </ul>
              </Section>

              <Section title="การจอง">
                <p>
                  จองห้องพักได้ง่ายๆ ผ่านเว็บไซต์ รองรับการชำระเงินหลายช่องทาง
                  และยกเลิกได้ตามนโยบายที่เลือก
                </p>
                <p>
                  <Link href="/rooms" className="text-primary hover:text-secondary font-semibold">
                    ดูห้องพักทั้งหมด →
                  </Link>
                </p>
              </Section>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl text-on-surface mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}
