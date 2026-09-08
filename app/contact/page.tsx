import type { Metadata } from 'next'
import Link from 'next/link'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'ติดต่อเรา — Zenzero Hotel',
  description: 'ช่องทางการติดต่อ Zenzero Hotel — โทรศัพท์ อีเมล และที่อยู่',
}

export default function ContactPage() {
  return (
    <>
      <TopNavBar />
      <main className="flex-1 bg-background">
        <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-16 md:py-24">
          <div className="max-w-3xl">
            <span className="text-label-md text-primary font-semibold uppercase tracking-wider">
              ติดต่อ
            </span>
            <h1 className="font-display text-3xl md:text-4xl text-on-surface mt-2 mb-8">
              ติดต่อเรา
            </h1>

            <p className="text-body-lg text-on-surface mb-10">
              เรายินดีตอบทุกคำถามและข้อสงสัยของท่าน ติดต่อเราได้หลายช่องทางดังนี้
            </p>

            <div className="grid gap-6 md:grid-cols-2">
              <ContactCard
                icon="call"
                label="โทรศัพท์"
                value="02-XXX-XXXX"
                hint="แผนกต้อนรับ 24 ชั่วโมง"
              />
              <ContactCard
                icon="mail"
                label="อีเมล"
                value="contact@zenzero.com"
                hint="ตอบกลับภายใน 24 ชั่วโมง"
              />
              <ContactCard
                icon="location_on"
                label="ที่อยู่"
                value="Zenzero Hotel, Bangkok, Thailand"
                hint="ดูแผนที่เพิ่มเติม"
              />
              <ContactCard
                icon="schedule"
                label="เวลาทำการ"
                value="เปิดบริการ 24/7"
                hint="แผนกต้อนรับพร้อมบริการทุกวัน"
              />
            </div>

            <section className="mt-12 pt-8 border-t border-outline-variant">
              <h2 className="font-display text-xl text-on-surface mb-4">
                ช่องทางอื่นๆ
              </h2>
              <div className="space-y-3 text-body-md text-on-surface-variant">
                <p>
                  <strong className="text-on-surface">สำหรับการจอง:</strong>{' '}
                  <Link href="/rooms" className="text-primary px-1 py-0.5 rounded hover:bg-primary-fixed hover:text-primary transition-colors duration-200">จองผ่านเว็บไซต์</Link>
                  {' '}หรือโทร 02-XXX-XXXX
                </p>
                <p>
                  <strong className="text-on-surface">สำหรับปัญหาการชำระเงิน:</strong>{' '}
                  <a href="mailto:billing@zenzero.com" className="text-primary px-1 py-0.5 rounded hover:bg-primary-fixed hover:text-primary transition-colors duration-200">
                    billing@zenzero.com
                  </a>
                </p>
                <p>
                  <strong className="text-on-surface">สำหรับคำขอส่วนบุคคล (PDPA):</strong>{' '}
                  <a href="mailto:privacy@zenzero.com" className="text-primary px-1 py-0.5 rounded hover:bg-primary-fixed hover:text-primary transition-colors duration-200">
                    privacy@zenzero.com
                  </a>
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

function ContactCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: string
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant">
      <MaterialIcon name={icon} size={32} className="text-primary mb-3" />
      <p className="text-caption text-on-surface-variant uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="font-display text-lg text-on-surface mb-1">{value}</p>
      <p className="text-caption text-on-surface-variant/70">{hint}</p>
    </div>
  )
}
