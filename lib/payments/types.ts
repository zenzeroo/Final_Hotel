/**
 * Phase 17 — Payment types shared between mock + real impls.
 *
 * `payment_method` + `status` are stored as `text + check` (not Postgres
 * enums) so adding `alipay`, `grabpay`, etc. doesn't require a schema
 * migration. The strings here are the source of truth.
 */

export type PaymentMethod = 'card' | 'promptpay' | 'cash'

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'expired' | 'refunded'

export interface Payment {
  id: string
  booking_id: string
  provider: string
  provider_session_id: string | null
  provider_event_id: string | null
  provider_payment_id: string | null
  payment_method: PaymentMethod
  amount: number
  currency: string
  status: PaymentStatus
  success_url: string | null
  cancel_url: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  paid_at: string | null
}