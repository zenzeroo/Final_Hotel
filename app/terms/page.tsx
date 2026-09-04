import type { Metadata } from 'next'
import { TopNavBar } from '@/components/layout/TopNavBar'
import { Footer } from '@/components/layout/Footer'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'เงื่อนไขการให้บริการ — Zenzero Hotel',
  description: 'เงื่อนไขและข้อกำหนดการใช้บริการ Zenzero Hotel',
}

export default function TermsPage() {
  return (
    <>
      <TopNavBar />
      <main className="flex-1 bg-background">
        <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-16 md:py-24">
          <div className="max-w-3xl">
            <span className="text-label-md text-primary font-semibold uppercase tracking-wider">
              ข้อกำหนด
            </span>
            <h1 className="font-display text-3xl md:text-4xl text-on-surface mt-2 mb-8">
              เงื่อนไขการให้บริการ
            </h1>

            <div className="space-y-6 text-body-md text-on-surface-variant">
              <p className="text-body-lg text-on-surface">
                การจองห้องพักกับ Zenzero Hotel ถือว่าท่านยอมรับเงื่อนไขการให้บริการดังต่อไปนี้
                โปรดอ่านอย่างละเอียดก่อนทำการจอง
              </p>

              <Section title="1. การจองและการชำระเงิน">
                <ul className="list-disc list-inside space-y-2">
                  <li>การจองจะสมบูรณ์เมื่อชำระเงินค่าห้องพักเรียบร้อยแล้ว</li>
                  <li>รองรับการชำระผ่านบัตรเครดิต/เดบิต, PromptPay และเงินสด ณ วันเช็คอิน</li>
                  <li>ราคาที่แสดงรวมภาษีมูลค่าเพิ่ม 7% และค่าธรรมเนียมรีสอร์ทแล้ว</li>
                </ul>
              </Section>

              <Section title="2. การเช็คอิน / เช็คเอาท์">
                <ul className="list-disc list-inside space-y-2">
                  <li>เวลาเช็คอิน: 14:00 น. เป็นต้นไป</li>
                  <li>เวลาเช็คเอาท์: 12:00 น. (เที่ยงวัน)</li>
                  <li>การเช็คอินก่อนเวลาหรือเช็คเอาท์หลังเวลาขึ้นอยู่กับดุลยพินิจของโรงแรมและอาจมีค่าใช้จ่ายเพิ่ม</li>
                  <li>ต้องแสดงบัตรประจำตัวประชาชนหรือหนังสือเดินทาง ณ วันเช็คอิน</li>
                </ul>
              </Section>

              <Section title="3. นโยบายการยกเลิก">
                <p>
                  นโยบายการยกเลิกขึ้นอยู่กับนโยบายที่เลือกตอนจอง (Flexible / Moderate / Strict):
                </p>
                <ul className="list-disc list-inside space-y-2">
                  <li><strong>Flexible</strong> — ยกเลิกฟรีภายใน 24 ชั่วโมงก่อนเช็คอิน คืนเงิน 100%</li>
                  <li><strong>Moderate</strong> — ยกเลิกฟรีภายใน 72 ชั่วโมงก่อนเช็คอิน คืนเงิน 100%</li>
                  <li><strong>Strict</strong> — ยกเลิกฟรีภายใน 168 ชั่วโมงก่อนเช็คอิน คืนเงิน 50%</li>
                </ul>
                <p>
                  หากไม่ปรากฏการยกเลิกก่อนเส้นตาย เงินค่าห้องพักจะไม่สามารถคืนได้
                </p>
              </Section>

              <Section title="4. ความรับผิดชอบของผู้เข้าพัก">
                <ul className="list-disc list-inside space-y-2">
                  <li>ห้ามสูบบุหรี่ในห้องพัก (ค่าปรับ 5,000 บาท)</li>
                  <li>ห้ามนำสัตว์เลี้ยงเข้าห้องพักโดยไม่ได้รับอนุญาต</li>
                  <li>ผู้เข้าพักรับผิดชอบค่าเสียหายที่เกิดขึ้นกับทรัพย์สินของโรงแรม</li>
                  <li>ห้ามจัดงานเลี้ยงหรือกิจกรรมที่ก่อให้เกิดเสียงดังรบกวนผู้อื่น</li>
                </ul>
              </Section>

              <Section title="5. ข้อจำกัดความรับผิด">
                <p>
                  Zenzero Hotel ไม่รับผิดชอบต่อการสูญหายหรือเสียหายของทรัพย์สินส่วนตัวที่ไม่ได้เก็บในตู้นิรภัย
                  หากพบปัญหา กรุณาแจ้งแผนกต้อนรับทันที
                </p>
              </Section>

              <Section title="6. การเปลี่ยนแปลงเงื่อนไข">
                <p>
                  เราขอสงวนสิทธิ์ในการปรับปรุงเงื่อนไขการให้บริการ การเปลี่ยนแปลงจะมีผลเมื่อประกาศในเว็บไซต์
                  การจองที่เกิดขึ้นก่อนการเปลี่ยนแปลงจะอยู่ภายใต้เงื่อนไขเดิม
                </p>
              </Section>

              <Section title="7. ข้อพิพาท">
                <p>
                  ข้อพิพาทใดๆ ที่เกิดขึ้นจะอยู่ภายใต้กฎหมายไทย
                  โดยศาลที่มีเขตอำนาจในจังหวัดที่โรงแรมตั้งอยู่เป็นผู้พิจารณา
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
