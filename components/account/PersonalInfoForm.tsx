'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { updateProfileAction } from '@/app/actions/account'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { DatePickerField } from '@/components/ui/DatePickerField'
import type { AccountProfile } from '@/lib/data/types'
import type { UserRole } from '@/lib/supabase/roles'
import { formatDate } from '@/lib/dates'

interface PersonalInfoFormProps {
  profile: AccountProfile
  /**
   * Current viewer's role. Staff roles (reception/housekeeper/manager/admin)
   * see name + birthdate as locked fields — only phone stays editable.
   * User role retains the full edit form.
   */
  role: UserRole | 'user'
}

const STAFF_ROLES: readonly UserRole[] = [
  'reception',
  'housekeeper',
  'manager',
  'admin',
]

function isStaffRole(role: UserRole | 'user'): role is UserRole {
  return STAFF_ROLES.includes(role as UserRole)
}

const VERIFIED_DATA_HINT =
  'ข้อมูลส่วนบุคคลที่ยืนยันตัวตนแล้ว หากต้องการเปลี่ยนกรุณาติดต่อผู้ดูแลระบบ'

interface FormState {
  error?: string
  success?: boolean
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
    <label className="flex flex-col gap-2">
      <span className="font-label-md text-label-md text-primary">
        {label}
        {required && <span className="text-error">*</span>}
      </span>
      {children}
    </label>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-primary text-on-primary px-6 py-2 rounded-full font-label-md text-label-md hover:bg-primary-fixed hover:text-primary transition-colors disabled:opacity-60 flex items-center gap-2"
    >
      {pending ? (
        <>
          <span className="inline-block w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
          กำลังบันทึก…
        </>
      ) : (
        <>
          <MaterialIcon name="check" size={18} />
          บันทึกการเปลี่ยนแปลง
        </>
      )}
    </button>
  )
}

/**
 * PersonalInfoForm — mirrors the mockup's Personal Info card with a view +
 * edit toggle. View mode renders readonly rows; Edit mode renders the form
 * via useActionState. On successful submit, returns to view mode.
 */
export function PersonalInfoForm({ profile, role }: PersonalInfoFormProps) {
  const [editing, setEditing] = useState(false)
  const verifiedDataLocked = isStaffRole(role)

  // Phone sentinel value used by migration 20260913_require_phone.sql to
  // backfill NULL phones for Google OAuth users (no real phone captured).
  // Detecting it here lets us prompt the staff member to update.
  const PHONE_SENTINEL = '0000000000'
  const phoneValue = (profile.phone ?? '').replace(/\D/g, '').slice(0, 10)
  const isPlaceholderPhone = phoneValue === PHONE_SENTINEL
  const hasInvalidDbPhone =
    !!profile.phone && !/^[0-9]{10}$/.test(profile.phone)

  // Wrap raw action to fit useActionState's (prev, formData) signature.
  const wrapped = async (
    _state: FormState | null,
    formData: FormData,
  ): Promise<FormState> => {
    const result = await updateProfileAction(null, formData)
    if (!result.ok) return { error: result.error }
    return { success: true }
  }

  const [state, formAction] = useActionState<FormState | null, FormData>(wrapped, null)

  if (editing) {
    return (
      <div className="bg-surface-container-lowest rounded-xl shadow-(--shadow-ambient) border border-surface-container">
        <div className="flex justify-between items-center p-gutter md:p-[32px] pb-base">
          <h3 className="font-headline-sm text-headline-sm text-primary">ข้อมูลส่วนตัว</h3>
        </div>
        <form action={formAction} className="px-gutter md:px-[32px] pb-gutter md:pb-[32px] flex flex-col gap-5">
          {hasInvalidDbPhone && (
            <div className="px-4 py-3 bg-error-container text-on-error-container rounded-lg text-body-md flex items-start gap-2">
              <MaterialIcon name="error" size={20} className="shrink-0 mt-0.5" />
              <div>
                <strong>เบอร์โทรศัพท์ของคุณไม่ถูกต้อง</strong>
                <p className="text-body-sm mt-1">
                  กรุณาติดต่อผู้ดูแลระบบเพื่ออัปเดตเบอร์โทรศัพท์
                </p>
              </div>
            </div>
          )}
          {state?.error && (
            <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-body-md text-error">
              {state.error}
            </div>
          )}
          {state?.success && (
            <div className="px-4 py-3 bg-secondary-container text-on-secondary-container rounded-lg text-body-md inline-flex items-center gap-2">
              <MaterialIcon name="check_circle" size={18} />
              บันทึกสำเร็จ
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
            <Field label="ชื่อ-นามสกุล (ตามบัตรประชาชน)" required={!verifiedDataLocked}>
              {verifiedDataLocked ? (
                <div className="relative">
                  <input
                    defaultValue={profile.full_name ?? ''}
                    disabled
                    className="w-full bg-surface-container border border-outline-variant rounded-lg py-3 px-4 text-body-md text-on-surface-variant cursor-not-allowed"
                  />
                  <MaterialIcon
                    name="lock"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant"
                  />
                </div>
              ) : (
                <input
                  name="fullName"
                  defaultValue={profile.full_name ?? ''}
                  required
                  className={inputClass}
                />
              )}
              <p className="font-caption text-caption text-on-surface-variant">
                {VERIFIED_DATA_HINT}
              </p>
            </Field>
            <Field label="วันเกิด">
              {verifiedDataLocked ? (
                <DatePickerField
                  defaultValue={profile.birthdate ?? ''}
                  disabled
                />
              ) : (
                <DatePickerField
                  name="birthdate"
                  defaultValue={profile.birthdate ?? ''}
                />
              )}
              <p className="font-caption text-caption text-on-surface-variant">
                {VERIFIED_DATA_HINT}
              </p>
            </Field>
            <Field label="อีเมล">
              <div className="relative">
                <input
                  defaultValue={profile.email ?? ''}
                  disabled
                  className="w-full bg-surface-container border border-outline-variant rounded-lg py-3 px-4 text-body-md text-on-surface-variant cursor-not-allowed"
                />
                <MaterialIcon
                  name="lock"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant"
                />
              </div>
              <p className="font-caption text-caption text-on-surface-variant">
                อีเมลผูกกับบัญชีเข้าสู่ระบบ หากต้องการเปลี่ยนกรุณาติดต่อผู้ดูแลระบบ
              </p>
            </Field>
            <Field label="เบอร์โทรศัพท์" required>
              <input
                name="phone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="08xxxxxxxx"
                defaultValue={phoneValue}
                onInput={(e) => {
                  const target = e.currentTarget
                  const cleaned = target.value.replace(/\D/g, '').slice(0, 10)
                  if (cleaned !== target.value) target.value = cleaned
                }}
                className={inputClass}
              />
              {isPlaceholderPhone ? (
                <div className="px-3 py-2 bg-warning-container text-on-warning-container rounded-md text-body-sm flex items-center gap-2">
                  <MaterialIcon name="warning" size={16} />
                  เบอร์โทรศัพท์ของคุณยังไม่ได้ตั้ง — กรุณากรอกเบอร์จริงเพื่อให้ลูกค้าติดต่อท่านได้
                </div>
              ) : (
                <p className="font-caption text-caption text-on-surface-variant">
                  ต้องเป็นตัวเลข 10 หลักเท่านั้น (ไม่มีขีด ไม่มีช่องว่าง)
                </p>
              )}
            </Field>
          </div>
          <div className="flex justify-end gap-3 mt-2 pt-gutter border-t border-surface-container">
            <button
              type="button"
              onClick={() => {
                setEditing(false)
              }}
              className="bg-transparent border border-outline-variant text-on-surface-variant px-6 py-2 rounded-full font-label-md text-label-md hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed transition-colors"
            >
              ยกเลิก
            </button>
            <SubmitButton />
          </div>
        </form>
      </div>
    )
  }

  // View mode
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-(--shadow-ambient) border border-surface-container">
      <div className="flex justify-between items-center p-gutter md:p-[32px] pb-base">
        <h3 className="font-headline-sm text-headline-sm text-primary">ข้อมูลส่วนตัว</h3>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-secondary px-2 py-1 rounded hover:bg-primary-fixed hover:text-primary transition-colors flex items-center gap-1 font-label-md text-label-md"
        >
          <MaterialIcon name="edit" size={18} />
          แก้ไข
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter px-gutter md:px-[32px] pb-gutter md:pb-[32px]">
        <Row label="ชื่อ-นามสกุล (ตามบัตรประชาชน)" value={profile.full_name ?? '—'} />
        <Row label="วันเกิด" value={profile.birthdate ? formatThaiDate(profile.birthdate) : '—'} />
        <Row
          label="อีเมล"
          value={profile.email ?? '—'}
          iconRight="lock"
        />
        <Row label="เบอร์โทรศัพท์" value={profile.phone ?? '—'} />
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  iconRight,
}: {
  label: string
  value: string
  iconRight?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-label-md text-label-md text-on-surface-variant">
        {label}
      </span>
      <span className="font-body-md text-body-md text-on-surface flex items-center gap-2">
        {value}
        {iconRight && <MaterialIcon name={iconRight} size={16} className="text-on-surface-variant" />}
      </span>
    </div>
  )
}

function formatThaiDate(iso: string): string {
  try {
    return formatDate(iso)
  } catch {
    return iso
  }
}