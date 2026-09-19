'use client'

import { useState, useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { Modal } from '@/components/ui/Modal'
import { createStaffAction } from '@/app/actions/admin/staff'

/**
 * Phase 33 — Modal pop-up wrapper for the staff creation flow.
 *
 * Replaces the inline `<AddStaffForm />` section that previously rendered
 * directly on `/admin/staff`. Mirrors the pattern used by
 * `CreateTaskModal` + `MaintenanceReportModal`: trigger button in the
 * page header opens a `<Modal>` containing the same form fields.
 *
 * Behavior:
 * - success → keep modal open, show generated password + เสร็จสิ้น button
 * - error   → keep modal open, inline error banner above form
 * - pending → close-on-backdrop disabled (prevents partial-submission abort)
 * - close   → 200ms delayed state reset prevents flicker
 *
 * Server action `createStaffAction` already calls
 * `revalidatePath('/admin/staff')` (lib: app/actions/admin/staff.ts:53) so
 * the table auto-refreshes on next render trigger after success.
 */
export function AddStaffModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await createStaffAction(form)
      if (result.ok && result.data?.initialPassword) {
        setGeneratedPassword(result.data.initialPassword)
        e.currentTarget?.reset() // clear inputs so admin can add another immediately
      } else if (!result.ok) {
        setError(result.error)
      }
    })
  }

  function handleClose() {
    if (isPending) return // guard against cancel mid-submit
    setIsOpen(false)
    // Delay state reset so the close animation doesn't flash the form
    // before unmount completes.
    setTimeout(() => {
      setError(null)
      setGeneratedPassword(null)
    }, 200)
  }

  const showSuccess = !!generatedPassword

  return (
    <>
      {/* Trigger button (renders inside the page header top-right) */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 bg-primary text-on-primary rounded-lg px-4 py-2 hover:bg-primary-fixed hover:text-primary transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
      >
        <MaterialIcon name="person_add" size={18} />
        เพิ่มพนักงาน
      </button>

      <Modal
        open={isOpen}
        onClose={handleClose}
        title={showSuccess ? 'สร้างบัญชีพนักงานสำเร็จ' : 'เพิ่มพนักงานใหม่'}
        showCloseButton
        maxWidthClass="max-w-2xl"
        closeOnBackdrop={!isPending}
        body={
          showSuccess ? (
            <SuccessState password={generatedPassword} onDone={handleClose} />
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {error && <ErrorBanner message={error} />}
              <FormGrid />
              <FormActions isPending={isPending} onCancel={handleClose} />
            </form>
          )
        }
      />
    </>
  )
}

// ── Sub-components (file-local) ────────────────────────────────────

function SuccessState({
  password,
  onDone,
}: {
  password: string
  onDone: () => void
}) {
  return (
    <div className="flex flex-col items-center text-center py-2">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary-container text-on-secondary-container mb-3">
        <MaterialIcon name="check_circle" size={28} />
      </div>
      <p className="text-body-md text-on-surface mb-4">
        กรุณาส่งรหัสผ่านเริ่มต้นนี้ให้พนักงานด้วยตัวเอง
        (ระบบจะไม่แสดงอีก):
      </p>
      <code className="block bg-secondary-container text-on-secondary-container px-6 py-3 rounded-lg font-mono text-body-lg mb-6 select-all">
        {password}
      </code>
      <button
        type="button"
        onClick={onDone}
        className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-on-primary rounded-lg hover:bg-primary-fixed hover:text-primary transition-colors"
      >
        <MaterialIcon name="check" size={18} />
        เสร็จสิ้น
      </button>
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-md text-error">
      {message}
    </div>
  )
}

const inputClass =
  'w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 px-4 text-body-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors'

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-label-md text-on-surface">
        {label}
        {required && <span className="text-error">*</span>}
      </span>
      {children}
    </label>
  )
}

function FormGrid() {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="ชื่อ-นามสกุล" required>
          <input
            name="full_name"
            type="text"
            placeholder="สมชาย ใจดี"
            required
            maxLength={120}
            className={inputClass}
          />
        </Field>

        <Field label="อีเมล" required>
          <input
            name="email"
            type="email"
            placeholder="newstaff@zenzero.com"
            required
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="เบอร์โทร" required>
          <input
            name="phone"
            type="tel"
            required
            inputMode="numeric"
            maxLength={10}
            minLength={10}
            pattern="[0-9]{10}"
            placeholder="0987654321"
            onChange={(e) => {
              const target = e.currentTarget
              const cleaned = target.value.replace(/\D/g, '').slice(0, 10)
              if (cleaned !== target.value) target.value = cleaned
            }}
            className={inputClass}
          />
        </Field>

        <Field label="บทบาท" required>
          <select name="role" defaultValue="reception" className={inputClass}>
            <option value="reception">พนักงานต้อนรับ</option>
            <option value="housekeeper">พนักงานทำความสะอาด</option>
            <option value="manager">ผู้จัดการ</option>
            <option value="admin">ผู้ดูแลระบบ</option>
          </select>
        </Field>
      </div>

      <Field label="รหัสผ่านเริ่มต้น (≥ 8 ตัวอักษร)" required>
        <input
          name="password"
          type="text"
          placeholder="เช่น Welcome2026!"
          required
          minLength={8}
          maxLength={72}
          className={`${inputClass} font-mono`}
        />
      </Field>
    </>
  )
}

function FormActions({
  isPending,
  onCancel,
}: {
  isPending: boolean
  onCancel: () => void
}) {
  return (
    <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={isPending}
        className="flex-1 inline-flex items-center justify-center px-6 py-3 border border-outline-variant rounded-lg text-label-md uppercase tracking-wider text-primary hover:bg-primary-fixed hover:border-primary-fixed transition-colors disabled:opacity-50"
      >
        ยกเลิก
      </button>
      <button
        type="submit"
        disabled={isPending}
        className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-lg font-semibold text-label-md uppercase tracking-wider hover:bg-primary-fixed hover:text-primary transition-colors disabled:opacity-60"
      >
        {isPending ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
            กำลังเพิ่มพนักงาน…
          </>
        ) : (
          <>
            <MaterialIcon name="person_add" size={18} />
            เพิ่มพนักงาน
          </>
        )}
      </button>
    </div>
  )
}
