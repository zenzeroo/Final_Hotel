/**
 * Thai + English error messages for Supabase / Zod errors.
 *
 * Why this exists: server actions receive `error.message` from Supabase and
 * `parsed.error.issues` from Zod, both of which are typically English. Without
 * translation, users see `"ไม่สามารถสร้างการจอง: <English Supabase error>"` —
 * confusing for Thai guests and unprofessional for English ones.
 *
 * `translateSupabaseError(message, locale?)` returns a localized string
 * in the active locale (default 'th'). Falls back to a generic localized
 * message when no pattern matches.
 *
 * `translateZodIssues(issues, locale?)` maps a list of Zod issues into a
 * single comma-joined user-facing string.
 */

import { toLocale, type Locale } from '@/lib/i18n/config'

/** Generic fallbacks. */
const GENERIC_FALLBACK: Record<Locale, string> = {
  th: 'ไม่สามารถดำเนินการได้ — กรุณาลองใหม่อีกครั้ง',
  en: 'Something went wrong — please try again',
}

/**
 * Map known Supabase / auth error messages to localized strings.
 *
 * Keys are case-insensitive substring matches against `error.message`.
 * Order matters — more specific patterns first.
 */
const SUPABASE_AUTH_ERROR_MAP: ReadonlyArray<readonly [RegExp, Record<Locale, string>]> = [
  // User-already-exists (Supabase returns this exact phrase)
  [/user already registered/i, {
    th: 'อีเมลนี้ถูกใช้สมัครแล้ว กรุณาเข้าสู่ระบบแทน',
    en: 'This email is already registered. Please sign in instead.',
  }],
  // Email-not-confirmed
  [/email not confirmed/i, {
    th: 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ',
    en: 'Please confirm your email before signing in.',
  }],
  // Weak / short password
  [/password.*at least\s*(\d+)/i, {
    th: 'รหัสผ่านต้องมีอย่างน้อย $1 ตัวอักษร',
    en: 'Password must be at least $1 characters.',
  }],
  [/password.*too short/i, {
    th: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร',
    en: 'Password must be at least 8 characters.',
  }],
  // Invalid credentials (usually sign-in)
  [/invalid login credentials/i, {
    th: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    en: 'Invalid email or password.',
  }],
  [/invalid credentials/i, {
    th: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    en: 'Invalid email or password.',
  }],
  // Rate limit
  [/over.*email.*send.*rate.*limit/i, {
    th: 'คุณส่งอีเมลบ่อยเกินไป กรุณารอสักครู่',
    en: 'You are sending emails too quickly. Please wait a moment.',
  }],
  [/rate limit/i, {
    th: 'คุณพยายามเข้าสู่ระบบหรือสมัครสมาชิกบ่อยเกินไป กรุณารอสักครู่',
    en: 'Too many sign-in or sign-up attempts. Please wait a moment.',
  }],
  // Security delay
  [/for security purposes, you can only request this after/i, {
    th: 'กรุณารอสักครู่ก่อนลองอีกครั้ง',
    en: 'Please wait a moment before trying again.',
  }],
  // Generic network / fetch
  [/network/i, {
    th: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ — กรุณาตรวจสอบอินเทอร์เน็ต',
    en: 'Cannot reach the server. Please check your internet connection.',
  }],
  // Unknown fallback
  [/unknown/i, {
    th: 'ไม่ทราบสาเหตุ — กรุณาลองใหม่อีกครั้ง',
    en: 'Unknown error — please try again.',
  }],
]

/**
 * Map common Supabase PostgREST / DB error patterns to localized strings.
 * Used for booking / payment / general insert failures.
 */
const SUPABASE_DB_ERROR_MAP: ReadonlyArray<readonly [RegExp, Record<Locale, string>]> = [
  [/duplicate key/i, {
    th: 'ข้อมูลซ้ำกับที่มีอยู่แล้วในระบบ',
    en: 'This record already exists.',
  }],
  [/unique constraint/i, {
    th: 'ข้อมูลซ้ำกับที่มีอยู่แล้วในระบบ',
    en: 'This record already exists.',
  }],
  [/row.level security/i, {
    th: 'คุณไม่มีสิทธิ์ดำเนินการนี้',
    en: 'You do not have permission for this action.',
  }],
  [/permission denied/i, {
    th: 'คุณไม่มีสิทธิ์ดำเนินการนี้',
    en: 'You do not have permission for this action.',
  }],
  [/foreign key/i, {
    th: 'ข้อมูลอ้างอิงไม่ถูกต้อง',
    en: 'Invalid reference data.',
  }],
  [/null value/i, {
    th: 'ข้อมูลไม่ครบถ้วน',
    en: 'Required field is missing.',
  }],
  [/violates check constraint/i, {
    th: 'ข้อมูลไม่ตรงตามเงื่อนไขของระบบ',
    en: 'Data does not meet system requirements.',
  }],
  [/timeout/i, {
    th: 'การเชื่อมต่อใช้เวลานานเกินไป กรุณาลองใหม่',
    en: 'Connection timed out. Please try again.',
  }],
  [/connection.*refused/i, {
    th: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้',
    en: 'Cannot connect to the database.',
  }],
]

/**
 * Translate a Supabase error message to the active locale.
 *
 * Returns the first matching localized string, or `GENERIC_FALLBACK[locale]`
 * when no pattern matches. Pass `null` / `undefined` / empty to get the fallback.
 */
export function translateSupabaseError(
  message: string | null | undefined,
  locale: Locale = 'th',
): string {
  if (!message || typeof message !== 'string') return GENERIC_FALLBACK[locale]

  for (const [pattern, strings] of SUPABASE_AUTH_ERROR_MAP) {
    if (pattern.test(message)) return strings[locale]
  }
  for (const [pattern, strings] of SUPABASE_DB_ERROR_MAP) {
    if (pattern.test(message)) return strings[locale]
  }

  // English fallback detection: if the message looks English (contains
  // spaces and ASCII letters and is longer than 5 chars), prefer the
  // localized fallback rather than leaking the raw English to the user.
  if (locale === 'en') {
    // In EN mode, return the message as-is when it looks English.
    return message
  }
  if (looksEnglish(message)) return GENERIC_FALLBACK[locale]

  // Otherwise assume the original is already Thai / safe — pass through.
  return message
}

const ZOD_PATTERNS: Array<{
  pattern: RegExp
  th: (match: RegExpMatchArray | null, field: string | null) => string
  en: (match: RegExpMatchArray | null, field: string | null) => string
}> = [
  {
    pattern: /required/i,
    th: (_, field) => (field ? `กรุณากรอก${field}` : 'กรุณากรอกข้อมูลให้ครบถ้วน'),
    en: (_, field) => (field ? `Please enter ${field}` : 'Please complete all required fields'),
  },
  {
    pattern: /invalid email/i,
    th: (_, field) => (field ? `${field}ไม่ถูกต้อง` : 'อีเมลไม่ถูกต้อง'),
    en: (_, field) => (field ? `Invalid ${field}` : 'Invalid email'),
  },
  {
    pattern: /string must contain at least (\d+) character/i,
    th: (m, field) => {
      const n = m?.[1] ?? '8'
      return field ? `${field}ต้องมีอย่างน้อย ${n} ตัวอักษร` : `ต้องมีอย่างน้อย ${n} ตัวอักษร`
    },
    en: (m, field) => {
      const n = m?.[1] ?? '8'
      return field ? `${field} must be at least ${n} characters` : `Must be at least ${n} characters`
    },
  },
  {
    pattern: /must be a valid uuid/i,
    th: () => 'ข้อมูลอ้างอิงไม่ถูกต้อง',
    en: () => 'Invalid reference data',
  },
  {
    pattern: /must be a number|expected number/i,
    th: (_, field) => (field ? `${field}ต้องเป็นตัวเลข` : 'ต้องเป็นตัวเลข'),
    en: (_, field) => (field ? `${field} must be a number` : 'Must be a number'),
  },
  {
    pattern: /invalid_string|invalid/i,
    th: (_, field) => (field ? `${field}ไม่ถูกต้อง` : 'ข้อมูลไม่ถูกต้อง'),
    en: (_, field) => (field ? `Invalid ${field}` : 'Invalid input'),
  },
]

/**
 * Translate a list of Zod issues to a single localized string suitable for
 * a user-facing error banner.
 */
export function translateZodIssues(
  issues: ReadonlyArray<{ path?: ReadonlyArray<string | number>; message: string }>,
  locale: Locale = 'th',
): string {
  if (!issues.length) return GENERIC_FALLBACK[locale]

  const translated = issues.map((issue) => {
    const field = issue.path && issue.path.length ? String(issue.path[0]) : null
    const fieldLabel = field ? fieldLabelLocalized(field, locale) : null
    const msg = issue.message

    for (const { pattern, th, en } of ZOD_PATTERNS) {
      if (pattern.test(msg)) {
        const m = msg.match(pattern)
        return locale === 'en' ? en(m, fieldLabel) : th(m, fieldLabel)
      }
    }
    return GENERIC_FALLBACK[locale]
  })

  return translated.join(', ')
}

/**
 * Map common form field names to localized labels for error messages.
 */
function fieldLabelLocalized(field: string, locale: Locale): string {
  const map: Record<string, Record<Locale, string>> = {
    email: { th: 'อีเมล', en: 'email' },
    password: { th: 'รหัสผ่าน', en: 'password' },
    confirmPassword: { th: 'รหัสผ่านยืนยัน', en: 'confirm password' },
    fullName: { th: 'ชื่อ-นามสกุล', en: 'full name' },
    full_name: { th: 'ชื่อ-นามสกุล', en: 'full name' },
    bookerFullName: { th: 'ชื่อ-นามสกุล', en: 'full name' },
    bookerEmail: { th: 'อีเมล', en: 'email' },
    bookerPhone: { th: 'เบอร์โทรศัพท์', en: 'phone number' },
    phone: { th: 'เบอร์โทรศัพท์', en: 'phone number' },
    birthdate: { th: 'วันเกิด', en: 'date of birth' },
    checkIn: { th: 'วันเช็คอิน', en: 'check-in date' },
    checkOut: { th: 'วันเช็คเอาท์', en: 'check-out date' },
    guests: { th: 'จำนวนผู้เข้าพัก', en: 'number of guests' },
    roomTypeId: { th: 'ประเภทห้องพัก', en: 'room type' },
    promoCode: { th: 'รหัสโปรโมชั่น', en: 'promo code' },
    rating: { th: 'คะแนน', en: 'rating' },
    title: { th: 'หัวข้อ', en: 'title' },
    body: { th: 'รายละเอียด', en: 'body' },
  }
  return map[field]?.[locale] ?? field
}

/**
 * Heuristic: does this string look like English prose?
 * Used to detect unknown Supabase errors that should be replaced with the
 * Thai fallback instead of leaking raw English to a Thai user.
 */
function looksEnglish(s: string): boolean {
  if (s.length < 5) return false
  const asciiLetterRun = /[A-Za-z]{3,}/
  if (!asciiLetterRun.test(s)) return false
  return /\s/.test(s) || /^[A-Z][a-z]+ [a-z]+/.test(s)
}

// Re-export `toLocale` for convenience so callers don't need to import
// from config separately.
export { toLocale }
