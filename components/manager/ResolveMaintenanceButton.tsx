'use client'

import { useState, useTransition } from 'react'
import { Modal } from '@/components/ui/Modal'
import { resolveMaintenanceReport } from '@/app/actions/maintenance'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

export function ResolveMaintenanceButton({ reportId }: { reportId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(formData: FormData) {
    setError(null)
    const id = formData.get('reportId') as string
    const note = (formData.get('resolutionNote') as string | null)?.trim() || undefined
    startTransition(async () => {
      const result = await resolveMaintenanceReport(id, note)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setIsOpen(false)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-on-primary text-caption font-semibold hover:bg-primary-fixed hover:text-primary transition-colors"
      >
        <MaterialIcon name="check_circle" size={16} />
        แก้ไขแล้ว
      </button>
      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title="แก้ไขรายงานเสร็จสิ้น"
        body={
          <form action={handleSubmit} className="flex flex-col gap-4">
            <input type="hidden" name="reportId" value={reportId} />
            <p className="text-body-md text-on-surface">
              รายงานจะถูกปิดและห้องจะกลับมาเป็นสถานะ <strong>ว่าง</strong> พร้อมรับแขกใหม่
            </p>
            <label className="flex flex-col gap-1">
              <span className="text-caption text-on-surface-variant uppercase tracking-wider">
                บันทึกการแก้ไข (ไม่บังคับ)
              </span>
              <textarea
                name="resolutionNote"
                rows={3}
                maxLength={500}
                placeholder="เช่น เปลี่ยนสายน้ำทิ้งใต้อ่างล้างหน้า ทดสอบการไหลปกติ"
                className="px-3 py-2 rounded-md border border-outline-variant bg-surface-container-lowest text-body-md focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </label>
            {error && <p className="text-body-md text-error">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                className="px-4 py-2 rounded-md text-body-md text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-on-primary text-body-md font-semibold hover:bg-primary-fixed hover:text-primary transition-colors disabled:opacity-50"
              >
                {isPending ? 'กำลังบันทึก...' : 'ยืนยันแก้ไขแล้ว'}
              </button>
            </div>
          </form>
        }
      />
    </>
  )
}
