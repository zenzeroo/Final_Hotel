/**
 * Phase 60 — notification catalog (pure, shared by server + client).
 * Must match the CHECK constraint in supabase/migrations/20261017_notifications.sql.
 * Text lives in the `notifications.types.<type>` dictionary entry; `params`
 * fill its {placeholders}.
 */

export const NOTIFICATION_TYPES = [
  // guest
  'payment_received',
  'payment_auto_refunded',
  'refund_approved',
  'refund_rejected',
  'booking_cancelled',
  'booking_expired',
  // staff
  'refund_requested_new',
  'maintenance_reported',
  'task_assigned',
  'booking_new',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export type NotificationParams = Record<string, string | number>

export interface NotificationRow {
  id: string
  type: NotificationType
  params: NotificationParams
  link: string | null
  read_at: string | null
  created_at: string
}

export const NOTIFICATION_ICON: Record<NotificationType, string> = {
  payment_received: 'payments',
  payment_auto_refunded: 'currency_exchange',
  refund_approved: 'check_circle',
  refund_rejected: 'cancel',
  booking_cancelled: 'event_busy',
  booking_expired: 'timer_off',
  refund_requested_new: 'request_quote',
  maintenance_reported: 'build',
  task_assigned: 'cleaning_services',
  booking_new: 'event_available',
}
