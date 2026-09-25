'use client'

import { MaterialIcon } from './MaterialIcon'
import { formatDateNumeric } from '@/lib/dates'

export interface DatePickerFieldProps {
  /**
   * Optional visible label rendered above the date. Omit when the
   * parent already wraps with its own `<label>` (e.g. `<Field>` from
   * admin forms).
   */
  label?: string
  /** ISO YYYY-MM-DD — controlled value. Required for controlled mode. */
  value?: string
  /** ISO YYYY-MM-DD — initial value for uncontrolled (FormData) mode. */
  defaultValue?: string
  /** ISO YYYY-MM-DD — `min` attribute on the hidden native input. */
  min?: string
  /** ISO YYYY-MM-DD — `max` attribute on the hidden native input. */
  max?: string
  /** Form field name — required for uncontrolled FormData submission. */
  name?: string
  /**
   * Material symbol name for the leading icon.
   * Pass `""` to omit the icon (compact variant — BookingWidget grid
   * cells). Default: `"calendar_today"`.
   */
  iconName?: string
  /**
   * Locked state — renders a subdued background + `cursor-not-allowed`
   * and a trailing `lock` icon. Used for verified-data fields (staff
   * birthdate per Phase 34.6). Hidden input is also `disabled`.
   */
  disabled?: boolean
  /** Required attribute forwarded to the hidden native input. */
  required?: boolean
  /** Fires when the date changes — only for controlled mode. */
  onChange?: (v: string) => void
  /** Accessible label — defaults to `label` when omitted. */
  'aria-label'?: string
}

/**
 * Styled date picker — DD/MM/YYYY Gregorian display + hidden native
 * `<input type="date">` that owns the click target, native calendar
 * UI, and `min`/`max` validation.
 *
 * Two modes:
 * - **Controlled** — pass `value` + `onChange`. Used in client widgets
 *   that re-derive other state from the date (SearchBar, BookingWidget,
 *   WalkInForm).
 * - **Uncontrolled** — pass `name` + optionally `defaultValue`. Used
 *   in server-action forms that read via `FormData.get(name)`
 *   (RegisterForm, PromotionForm, SeasonalRateForm, PersonalInfoForm
 *   editable variant).
 *
 * Variants:
 * - **Default** — leading icon + label + numeric date (forms)
 * - **Compact** — `iconName=""` for grid-cell layouts (BookingWidget)
 * - **Disabled** — `disabled` for verified/locked fields
 *
 * Why hidden input + custom display: native `<input type="date">`
 * renders MM/DD/YYYY or DD/MM/YYYY depending on browser locale (and
 * doesn't accept the `calendar: 'gregory'` option), so we hide the
 * native picker behind a styled DD/MM/YYYY label while keeping all
 * native validation/picker UX intact.
 */
export function DatePickerField({
  label,
  value,
  defaultValue,
  min,
  max,
  name,
  iconName = 'calendar_today',
  disabled = false,
  required = false,
  onChange,
  'aria-label': ariaLabel,
}: DatePickerFieldProps) {
  const computedAriaLabel = ariaLabel ?? label
  const isControlled = value !== undefined

  return (
    <div
      className={`relative w-full rounded-lg transition-colors ${
        disabled
          ? 'bg-surface-container border border-outline-variant cursor-not-allowed'
          : 'bg-surface-container-low border border-outline-variant hover:border-secondary focus-within:border-secondary focus-within:ring-1 focus-within:ring-secondary'
      }`}
    >
      <label
        className={`flex items-center gap-3 ${label ? 'px-4 py-3' : 'px-3 py-3'} ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {iconName && (
          <MaterialIcon
            name={iconName}
            size={20}
            className={`shrink-0 ${disabled ? 'text-on-surface-variant' : 'text-on-surface-variant'}`}
          />
        )}
        <div className="flex flex-col flex-1 min-w-0">
          {label && (
            <span className="text-caption text-on-surface-variant font-semibold uppercase tracking-wider">
              {label}
            </span>
          )}
          <span className="text-body-md font-medium text-on-surface">
            {formatDateNumeric(isControlled ? value ?? '' : defaultValue ?? '')}
          </span>
        </div>
        {disabled && (
          <MaterialIcon
            name="lock"
            size={18}
            className="text-on-surface-variant shrink-0"
          />
        )}
        {/* Hidden native input — covers the wrapper for click target +
            native picker + min/max validation. `opacity-0` keeps it
            in the accessibility tree while invisible. */}
        <input
          type="date"
          value={isControlled ? value : undefined}
          defaultValue={!isControlled ? defaultValue : undefined}
          min={min}
          max={max}
          name={name}
          disabled={disabled}
          required={required}
          onChange={
            isControlled && onChange
              ? (e) => onChange(e.target.value)
              : undefined
          }
          aria-label={computedAriaLabel}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
      </label>
    </div>
  )
}
