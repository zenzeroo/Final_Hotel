'use client'

/**
 * Phase 13 — Password input with built-in show/hide toggle.
 *
 * Wraps the existing left-aligned lock icon pattern (`<div className="relative">`
 * + `<MaterialIcon name="lock" />`) and adds a right-aligned eye toggle.
 * Default state is hidden (industry-standard safer default).
 *
 * Spreads all native `<input>` props (`name`, `placeholder`, `autoComplete`,
 * `minLength`, `required`, …) onto the underlying input so it can replace the
 * raw `<input type="password" />` in forms without any other refactor.
 *
 * Usage:
 *   <PasswordInput
 *     name="password"
 *     placeholder="••••••••"
 *     required
 *     minLength={8}
 *     autoComplete="current-password"
 *   />
 */

import { useState } from 'react'
import { MaterialIcon } from './MaterialIcon'

// Type alias (not empty interface) — passes the
// @typescript-eslint/no-empty-object-type rule. Accepts every native <input>
// prop via React's InputHTMLAttributes.
export type PasswordInputProps = React.InputHTMLAttributes<HTMLInputElement>

export function PasswordInput({ className, ...rest }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  // Base class string mirrors the other inputs in LoginForm/RegisterForm
  // (booking forms, admin forms all use the same surface/border/rounded/focus
  // pattern). `pr-10` (vs the raw `pr-4`) reserves space for the toggle icon.
  const baseInput =
    'w-full bg-surface-container-low border border-outline-variant rounded-lg py-3 pl-10 pr-10 text-body-md text-on-surface placeholder:text-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors'

  return (
    <div className="relative">
      <MaterialIcon
        name="lock"
        size={20}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
      />
      <input
        {...rest}
        type={visible ? 'text' : 'password'}
        className={className ? `${baseInput} ${className}` : baseInput}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
        aria-pressed={visible}
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 rounded-md text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-1"
      >
        <MaterialIcon name={visible ? 'visibility_off' : 'visibility'} size={20} />
      </button>
    </div>
  )
}
