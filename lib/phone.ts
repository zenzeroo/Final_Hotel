/**
 * Hide the middle of a phone number for staff lists: keep the first 3 and
 * last 2 digits. `0612345687` → `061-xxx-xx87`.
 */
export function maskPhone(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 5) return 'xxx'
  if (digits.length === 10) return `${digits.slice(0, 3)}-xxx-xx${digits.slice(8)}`
  return `${digits.slice(0, 3)}-${'x'.repeat(digits.length - 5)}-${digits.slice(-2)}`
}
