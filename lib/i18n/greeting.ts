import type { getT } from './t'

/**
 * Good morning / afternoon / evening by the hotel's clock (Asia/Bangkok),
 * not the server's (UTC on Vercel). `h23` keeps midnight at 0, not 24.
 */
export function greeting(t: ReturnType<typeof getT>, now: Date = new Date()): string {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Bangkok' }).format(now))
  if (h < 12) return t('manager.greetingMorning')
  if (h < 18) return t('manager.greetingAfternoon')
  return t('manager.greetingEvening')
}
