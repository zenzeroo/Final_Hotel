/**
 * Thai-translated error messages for Supabase / Zod errors that would
 * otherwise leak raw English to user-facing banners.
 *
 * Why this exists: server actions receive `error.message` from Supabase and
 * `parsed.error.issues` from Zod, both of which are typically English. If a
 * server action concatenates `error.message` to a Thai prefix, users see
 * `"ไม่สามารถสร้างการจอง: <English Supabase error>"` — confusing for Thai
 * guests.
 *
 * Use the `translate*` exports from server actions. They return a Thai
 * message, falling back to a generic Thai fallback when the input doesn't
 * match any known pattern.
 */

/**
 * Generic Thai fallback for errors we can't recognise.
 */
const GENERIC_FALLBACK = 'ไม่สามารถดำเนินการได้ — กรุณาลองใหม่อีกครั้ง'

/**
 * Map known Supabase / auth error messages to Thai.
 *
 * Keys are case-insensitive substring matches against `error.message` (and
 * `error.code` where useful). Order matters — more specific patterns first.
 */
const SUPABASE_AUTH_ERROR_MAP: ReadonlyArray<readonly [RegExp, string]> = [
  // User-already-exists (Supabase returns this exact phrase)
  [/user already registered/i, 'อีเมลนี้ถูกใช้สมัครแล้ว กรุณาเข้าสู่ระบบแทน'],
  // Email-not-confirmed
  [/email not confirmed/i, 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ'],
  // Weak / short password (various Supabase phrasings)
  [/password.*at least\s*(\d+)/i, 'รหัสผ่านต้องมีอย่างน้อย $1 ตัวอักษร'],
  [/password.*too short/i, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'],
  // Invalid credentials (usually sign-in)
  [/invalid login credentials/i, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'],
  [/invalid credentials/i, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'],
  // Rate limit
  [/over.*email.*send.*rate.*limit/i, 'คุณส่งอีเมลบ่อยเกินไป กรุณารอสักครู่'],
  [/rate limit/i, 'คุณพยายามเข้าสู่ระบบหรือสมัครสมาชิกบ่อยเกินไป กรุณารอสักครู่'],
  // Security delay
  [/for security purposes, you can only request this after/i, 'กรุณารอสักครู่ก่อนลองอีกครั้ง'],
  // Generic network / fetch
  [/network/i, 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ — กรุณาตรวจสอบอินเทอร์เน็ต'],
  // Unknown fallback (Supabase "Database error saving new user" etc.)
  [/unknown/i, 'ไม่ทราบสาเหตุ — กรุณาลองใหม่อีกครั้ง'],
]

/**
 * Map common Supabase PostgREST / DB error patterns to Thai.
 * Used for booking / payment / general insert failures.
 */
const SUPABASE_DB_ERROR_MAP: ReadonlyArray<readonly [RegExp, string]> = [
  // Unique constraint violations (e.g. duplicate booking code)
  [/duplicate key/i, 'ข้อมูลซ้ำกับที่มีอยู่แล้วในระบบ'],
  [/unique constraint/i, 'ข้อมูลซ้ำกับที่มีอยู่แล้วในระบบ'],
  // RLS / permission
  [/row.level security/i, 'คุณไม่มีสิทธิ์ดำเนินการนี้'],
  [/permission denied/i, 'คุณไม่มีสิทธิ์ดำเนินการนี้'],
  // FK / not-null violations
  [/foreign key/i, 'ข้อมูลอ้างอิงไม่ถูกต้อง'],
  [/null value/i, 'ข้อมูลไม่ครบถ้วน'],
  [/violates check constraint/i, 'ข้อมูลไม่ตรงตามเงื่อนไขของระบบ'],
  // Connection / timeout
  [/timeout/i, 'การเชื่อมต่อใช้เวลานานเกินไป กรุณาลองใหม่'],
  [/connection.*refused/i, 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้'],
]

/**
 * Translate a Supabase error message to Thai.
 *
 * Returns the first matching Thai message, or `GENERIC_FALLBACK` when no
 * pattern matches. Pass `null` / `undefined` / empty to get the fallback.
 */
export function translateSupabaseError(message: string | null | undefined): string {
  if (!message || typeof message !== 'string') return GENERIC_FALLBACK

  for (const [pattern, thai] of SUPABASE_AUTH_ERROR_MAP) {
    if (pattern.test(message)) return thai
  }
  for (const [pattern, thai] of SUPABASE_DB_ERROR_MAP) {
    if (pattern.test(message)) return thai
  }

  // English fallback detection: if the message looks English (contains spaces
  // and ASCII letters and is longer than 5 chars), prefer the Thai fallback
  // rather than leaking the raw English to the user.
  if (looksEnglish(message)) return GENERIC_FALLBACK

  // Otherwise assume the original is already Thai / safe — pass through.
  return message
}

/**
 * Translate a list of Zod issues to a single Thai string suitable for a
 * user-facing error banner.
 *
 * Zod issue `message` is usually English ("Required", "Invalid email",
 * "String must contain at least 8 character(s)"). We translate the most
 * common patterns; the rest fall back to a generic Thai phrase.
 */
export function translateZodIssues(
  issues: ReadonlyArray<{ path?: ReadonlyArray<string | number>; message: string }>,
): string {
  if (!issues.length) return GENERIC_FALLBACK

  const translated = issues.map((issue) => {
    const field = issue.path && issue.path.length ? String(issue.path[0]) : null
    const fieldLabel = field ? fieldLabelThai(field) : null
    const msg = issue.message

    // Common Zod messages
    if (/required/i.test(msg)) {
      return fieldLabel ? `กรุณากรอก${fieldLabel}` : 'กรุณากรอกข้อมูลให้ครบถ้วน'
    }
    if (/invalid email/i.test(msg)) {
      return fieldLabel ? `${fieldLabel}ไม่ถูกต้อง` : 'อีเมลไม่ถูกต้อง'
    }
    if (/string must contain at least (\d+) character/i.test(msg)) {
      const n = msg.match(/at least (\d+)/)?.[1] ?? '8'
      return fieldLabel
        ? `${fieldLabel}ต้องมีอย่างน้อย ${n} ตัวอักษร`
        : `ต้องมีอย่างน้อย ${n} ตัวอักษร`
    }
    if (/must be a valid uuid/i.test(msg)) {
      return 'ข้อมูลอ้างอิงไม่ถูกต้อง'
    }
    if (/must be a number/i.test(msg) || /expected number/i.test(msg)) {
      return fieldLabel ? `${fieldLabel}ต้องเป็นตัวเลข` : 'ต้องเป็นตัวเลข'
    }
    if (/invalid_string/i.test(msg) || /invalid/i.test(msg)) {
      return fieldLabel ? `${fieldLabel}ไม่ถูกต้อง` : 'ข้อมูลไม่ถูกต้อง'
    }

    // Fallback for unknown Zod messages — return Thai generic
    return GENERIC_FALLBACK
  })

  return translated.join(', ')
}

/**
 * Map common form field names to Thai labels for error messages.
 * Falls back to the raw field name when not recognised.
 */
function fieldLabelThai(field: string): string {
  const map: Record<string, string> = {
    email: 'อีเมล',
    password: 'รหัสผ่าน',
    confirmPassword: 'รหัสผ่านยืนยัน',
    fullName: 'ชื่อ-นามสกุล',
    full_name: 'ชื่อ-นามสกุล',
    bookerFullName: 'ชื่อ-นามสกุล',
    bookerEmail: 'อีเมล',
    bookerPhone: 'เบอร์โทรศัพท์',
    phone: 'เบอร์โทรศัพท์',
    checkIn: 'วันเช็คอิน',
    checkOut: 'วันเช็คเอาท์',
    guests: 'จำนวนผู้เข้าพัก',
    roomTypeId: 'ประเภทห้องพัก',
    promoCode: 'รหัสโปรโมชั่น',
    rating: 'คะแนน',
    title: 'หัวข้อ',
    body: 'รายละเอียด',
  }
  return map[field] ?? field
}

/**
 * Heuristic: does this string look like English prose?
 * Used to detect unknown Supabase errors that should be replaced with the
 * Thai fallback instead of leaking raw English.
 */
function looksEnglish(s: string): boolean {
  if (s.length < 5) return false
  // Must contain at least 2 ASCII letters separated by something
  const asciiLetterRun = /[A-Za-z]{3,}/
  if (!asciiLetterRun.test(s)) return false
  // Must have at least one space (English sentences do, code-style errors might not)
  return /\s/.test(s) || /^[A-Z][a-z]+ [a-z]+/.test(s)
}