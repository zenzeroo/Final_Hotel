import type { Metadata } from 'next'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'นโยบายความเป็นส่วนตัว — Zenzero Hotel',
  description: 'นโยบายความเป็นส่วนตัวและการคุ้มครองข้อมูลส่วนบุคคลของ Zenzero Hotel',
}

export default function PrivacyPage() {
  return (
    <>
      <TopNavBar />
      <main className="flex-1 bg-background">
        <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-16 md:py-24">
          <div className="max-w-3xl">
            <span className="text-label-md text-primary font-semibold uppercase tracking-wider">
              นโยบาย
            </span>
            <h1 className="font-display text-3xl md:text-4xl text-on-surface mt-2 mb-8">
              นโยบายความเป็นส่วนตัว
            </h1>

            <div className="prose-like space-y-6 text-body-md text-on-surface-variant">
              <p className="text-body-lg text-on-surface">
                Zenzero Hotel เคารพสิทธิ์ความเป็นส่วนตัวของผู้เข้าพักและผู้ใช้บริการทุกท่าน
                เราจัดเก็บและใช้ข้อมูลส่วนบุคคลของท่านตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล
                พ.ศ. 2562 (PDPA) และกฎหมายที่เกี่ยวข้อง
              </p>

              <Section title="ข้อมูลที่เราจัดเก็บ">
                <ul className="list-disc list-inside space-y-2">
                  <li>ข้อมูลบัญชีผู้ใช้: ชื่อ-นามสกุล, อีเมล, หมายเลขโทรศัพท์</li>
                  <li>ข้อมูลการจอง: วันที่เข้าพัก-ออก, ประเภทห้อง, จำนวนผู้เข้าพัก, คำขอพิเศษ</li>
                  <li>ข้อมูลการชำระเงิน: จัดเก็บผ่าน Stripe (PCI-DSS compliant) — เราไม่เก็บเลขบัตรเครดิต</li>
                  <li>ข้อมูลการใช้งานเว็บไซต์: cookies, IP address, ประเภทเบราว์เซอร์</li>
                </ul>
              </Section>

              <Section title="วัตถุประสงค์ในการใช้ข้อมูล">
                <ul className="list-disc list-inside space-y-2">
                  <li>ประมวลผลและยืนยันการจองห้องพัก</li>
                  <li>ส่งการแจ้งเตือนเกี่ยวกับการจอง การชำระเงิน และการยกเลิก</li>
                  <li>ออกใบเสร็จรับเงินและใบกำกับภาษี</li>
                  <li>ปรับปรุงบริการและแก้ไขปัญหาทางเทคนิค</li>
                  <li>ปฏิบัติตามกฎหมายที่เกี่ยวข้อง (เช่น รายงานตาม พ.ร.บ. โรงแรม)</li>
                </ul>
              </Section>

              <Section title="การเปิดเผยข้อมูล">
                <p>
                  เราจะไม่เปิดเผยข้อมูลส่วนบุคคลของท่านต่อบุคคลที่สาม ยกเว้น:
                </p>
                <ul className="list-disc list-inside space-y-2">
                  <li>Stripe — ผู้ให้บริการประมวลผลการชำระเงิน (เฉพาะข้อมูลที่จำเป็น)</li>
                  <li>ผู้ให้บริการอีเมล (Resend) — สำหรับส่งใบยืนยันการจองและใบเสร็จ</li>
                  <li>หน่วยงานราชการ — เมื่อมีคำสั่งตามกฎหมาย</li>
                </ul>
              </Section>

              <Section title="สิทธิ์ของท่าน">
                <p>ท่านมีสิทธิ์:</p>
                <ul className="list-disc list-inside space-y-2">
                  <li>ขอเข้าถึงข้อมูลส่วนบุคคลของท่าน</li>
                  <li>ขอแก้ไขหรือลบข้อมูล</li>
                  <li>คัดค้านการประมวลผลข้อมูล</li>
                  <li>ขอให้โอนย้ายข้อมูล (Data Portability)</li>
                </ul>
                <p>
                  ติดต่อเราได้ที่ <a href="mailto:privacy@zenzero.com" className="text-primary hover:text-secondary">privacy@zenzero.com</a>
                </p>
              </Section>

              <Section title="นโยบาย cookies">
                <p>
                  เราใช้ cookies ที่จำเป็นสำหรับการเข้าสู่ระบบและการทำงานของเว็บไซต์
                  ท่านสามารถปิด cookies ในเบราว์เซอร์ได้ แต่อาจทำให้บางฟีเจอร์ทำงานไม่สมบูรณ์
                </p>
              </Section>

              <p className="text-caption text-on-surface-variant/70 pt-4">
                อัปเดตล่าสุด: {new Date().getFullYear()} — Zenzero Hotel
              </p>
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
