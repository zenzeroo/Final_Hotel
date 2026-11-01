import type { Metadata } from 'next'
import { getRefundMinDays } from '@/lib/data/bookings'
import { getCurrentLegalVersion } from '@/lib/data/legal'
import { getHotelSettings } from '@/lib/data/manager'
import { PublishedLegalPage } from '@/components/legal/PublishedLegalPage'
import { LegalPageShell, type LegalSection } from '@/components/legal/LegalPageShell'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'เงื่อนไขการให้บริการ — Zenzero Hotel',
  description: 'เงื่อนไขและข้อกำหนดการใช้บริการ Zenzero Hotel',
}

export default async function TermsPage() {
  // Phase 62 — once the admin has published PDFs (/admin/legal), show those.
  const published = await getCurrentLegalVersion()
  if (published) {
    const locale = await getLocale()
    const t = getT(locale)
    return (
      <PublishedLegalPage
        kind="terms"
        row={published}
        locale={locale}
        title={t('legal.termsTitle')}
      />
    )
  }

  // Phase 57c — same number the refund RPCs enforce.
  const [refundMinDays, locale, settings] = await Promise.all([getRefundMinDays(), getLocale(), getHotelSettings()])
  // Stay times come from the admin's hotel settings, like /contact and the booking emails.
  const checkIn = (settings?.check_in_time ?? '15:00').slice(0, 5)
  const checkOut = (settings?.check_out_time ?? '11:00').slice(0, 5)
  const sections: LegalSection[] = [
    {
      id: 'booking',
      title: '1. การจองและการชำระเงิน',
      body: (
        <ul>
          <li>การจองจะสมบูรณ์เมื่อชำระเงินค่าห้องพักเรียบร้อยแล้ว</li>
          <li>รองรับการชำระผ่านบัตรเครดิต/เดบิต, PromptPay และเงินสด ณ วันเช็คอิน</li>
          <li>ราคาที่แสดงรวมภาษีมูลค่าเพิ่ม 7% และค่าธรรมเนียมรีสอร์ทแล้ว</li>
        </ul>
      ),
    },
    {
      id: 'check-in',
      title: '2. การเช็คอิน / เช็คเอาท์',
      body: (
        <ul>
          <li>เวลาเช็คอิน: {checkIn} น. เป็นต้นไป</li>
          <li>เวลาเช็คเอาท์: ภายใน {checkOut} น.</li>
          <li>การเช็คอินก่อนเวลาหรือเช็คเอาท์หลังเวลาขึ้นอยู่กับดุลยพินิจของโรงแรมและอาจมีค่าใช้จ่ายเพิ่ม</li>
          <li>ต้องแสดงบัตรประจำตัวประชาชนหรือหนังสือเดินทาง ณ วันเช็คอิน</li>
        </ul>
      ),
    },
    {
      id: 'refund',
      title: '3. การยกเลิกและการคืนเงิน',
      body: (
        <ul>
          <li>
            ขอคืนเงินก่อนวันเช็คอิน {refundMinDays} วัน ได้เงินคืน<strong>เต็มจำนวน</strong>{' '}
            (นับตามวันที่ เวลาประเทศไทย เช่น เช็คอิน 24/10 ขอได้ถึง 22/10) และต้องได้รับการอนุมัติจากผู้จัดการ
          </li>
          <li>หากยื่นคำขอน้อยกว่า {refundMinDays} วันก่อนวันเช็คอิน จะไม่สามารถคืนเงินได้</li>
          <li>ขอคืนเงินได้ 1 ครั้งต่อการจอง หากคำขอถูกปฏิเสธ การจองยังคงมีผลตามเดิม</li>
          <li>การจองที่ยังไม่ได้ชำระเงินสามารถยกเลิกได้โดยไม่มีค่าใช้จ่าย</li>
        </ul>
      ),
    },
    {
      id: 'guests',
      title: '4. ความรับผิดชอบของผู้เข้าพัก',
      body: (
        <ul>
          <li>ห้ามสูบบุหรี่ในห้องพัก (ค่าปรับ 5,000 บาท)</li>
          <li>ห้ามนำสัตว์เลี้ยงเข้าห้องพักโดยไม่ได้รับอนุญาต</li>
          <li>ผู้เข้าพักรับผิดชอบค่าเสียหายที่เกิดขึ้นกับทรัพย์สินของโรงแรม</li>
          <li>ห้ามจัดงานเลี้ยงหรือกิจกรรมที่ก่อให้เกิดเสียงดังรบกวนผู้อื่น</li>
        </ul>
      ),
    },
    {
      id: 'liability',
      title: '5. ข้อจำกัดความรับผิด',
      body: (
        <p>
          Zenzero Hotel ไม่รับผิดชอบต่อการสูญหายหรือเสียหายของทรัพย์สินส่วนตัวที่ไม่ได้เก็บในตู้นิรภัย
          หากพบปัญหา กรุณาแจ้งแผนกต้อนรับทันที
        </p>
      ),
    },
    {
      id: 'changes',
      title: '6. การเปลี่ยนแปลงเงื่อนไข',
      body: (
        <p>
          เราขอสงวนสิทธิ์ในการปรับปรุงเงื่อนไขการให้บริการ การเปลี่ยนแปลงจะมีผลเมื่อประกาศในเว็บไซต์
          การจองที่เกิดขึ้นก่อนการเปลี่ยนแปลงจะอยู่ภายใต้เงื่อนไขเดิม
        </p>
      ),
    },
    {
      id: 'disputes',
      title: '7. ข้อพิพาท',
      body: (
        <p>
          ข้อพิพาทใดๆ ที่เกิดขึ้นจะอยู่ภายใต้กฎหมายไทย
          โดยศาลที่มีเขตอำนาจในจังหวัดที่โรงแรมตั้งอยู่เป็นผู้พิจารณา
        </p>
      ),
    },
  ]

  return (
    <LegalPageShell
      kind="terms"
      locale={locale}
      title="เงื่อนไขการให้บริการ"
      intro="การจองห้องพักกับ Zenzero Hotel ถือว่าท่านยอมรับเงื่อนไขการให้บริการดังต่อไปนี้ โปรดอ่านอย่างละเอียดก่อนทำการจอง"
      updated={`อัปเดตล่าสุด: ${new Date().getFullYear()} — Zenzero Hotel`}
      sections={sections}
    />
  )
}
