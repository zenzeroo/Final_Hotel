/**
 * Phase 17 — Mock payments impl (USE_MOCK_DATA=1 parity).
 *
 * Module-scope mutable `state[]` mirrors mutations across requests during dev.
 * Seeded from `data/mock-payments.json`. NOT safe across multiple processes —
 * mock is single-tab dev only.
 */

import mockData from '@/data/mock-payments.json'
import type { Payment } from '@/lib/payments/types'

const state: Payment[] = (mockData as Payment[]).map((p) => ({ ...p }))

export async function createPaymentSession(input: {
  bookingId: string
  amount?: number
  currency?: string
}): Promise<Payment> {
  const p: Payment = {
    id: crypto.randomUUID(),
    booking_id: input.bookingId,
    provider: 'mock',
    provider_session_id: 'cs_mock_' + Date.now(),
    provider_event_id: null,
    provider_payment_id: null,
    payment_method: 'card',
    amount: input.amount ?? 0,
    currency: input.currency ?? 'THB',
    status: 'pending',
    success_url: null,
    cancel_url: null,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    paid_at: null,
  }
  state.unshift(p)
  return p
}

export async function getPaymentBySessionId(sessionId: string): Promise<Payment | null> {
  return state.find((p) => p.provider_session_id === sessionId) ?? null
}

export async function listPaymentsByBooking(bookingId: string): Promise<Payment[]> {
  return state.filter((p) => p.booking_id === bookingId)
}

export async function updatePaymentSessionId(input: {
  paymentId: string
  sessionId: string
  successUrl?: string | null
  cancelUrl?: string | null
}): Promise<Payment | null> {
  const p = state.find((x) => x.id === input.paymentId)
  if (!p) return null
  p.provider_session_id = input.sessionId
  p.success_url = input.successUrl ?? null
  p.cancel_url = input.cancelUrl ?? null
  p.updated_at = new Date().toISOString()
  return p
}