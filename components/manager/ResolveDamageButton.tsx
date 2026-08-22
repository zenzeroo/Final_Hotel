'use client'

import { useState, useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { resolveDamageReportAction } from '@/app/actions/manager'

interface ResolveDamageButtonProps {
  reportId: string
  defaultCost: number | null
}

export function ResolveDamageButton({ reportId, defaultCost }: ResolveDamageButtonProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await resolveDamageReportAction(formData)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setOpen(false)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-caption text-primary underline underline-offset-4 hover:text-secondary"
      >
        เรียกเก็บเงินลูกค้า
        <MaterialIcon name="arrow_forward" size={14} />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            action={handleSubmit}
            className="w-full max-w-md bg-surface-container-lowest rounded-lg shadow-level-2 p-6"
          >
            <h3 className="font-headline-sm text-headline-sm text-primary mb-4">
              Resolve Damage Report
            </h3>
            <input type="hidden" name="reportId" value={reportId} />

            <label className="block mb-3">
              <span className="text-label-md uppercase tracking-wider text-on-surface-variant">
                Cost Estimate (THB)
              </span>
              <input
                type="number"
                name="costEstimate"
                min={0}
                step="1"
                required
                defaultValue={defaultCost ?? 0}
                className="mt-1 w-full rounded-md border border-outline-variant px-3 py-2 bg-surface-container-low text-body-md"
              />
            </label>

            <label className="block mb-3">
              <span className="text-label-md uppercase tracking-wider text-on-surface-variant">
                Resolution Note
              </span>
              <textarea
                name="resolutionNote"
                required
                maxLength={500}
                rows={3}
                placeholder="เช่น ส่งซ่อมร้าน X, เปลี่ยนของใหม่"
                className="mt-1 w-full rounded-md border border-outline-variant px-3 py-2 bg-surface-container-low text-body-md"
              />
            </label>

            {error ? (
              <p className="text-caption text-error mb-3" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="px-4 py-2 rounded-md text-body-md text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={pending}
                className="px-4 py-2 rounded-md bg-primary text-secondary text-body-md font-semibold disabled:opacity-50"
              >
                {pending ? 'กำลังบันทึก...' : 'Confirm Resolve'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  )
}
