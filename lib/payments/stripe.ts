/**
 * Phase 17 — Stripe SDK singleton.
 *
 * Returns `null` when `hasPaymentGateway=false` (no `STRIPE_SECRET_KEY`).
 * Callers MUST early-return before touching the singleton — see
 * `app/actions/payment.ts` and `app/api/payments/webhook/route.ts`.
 *
 * `apiVersion` is intentionally omitted — the SDK uses its bundled default
 * (matches the SDK's response/request shape). Stripe SDK v22 pins
 * `'2026-08-26.dahlia'`. Override only when deliberately targeting an older
 * API surface.
 */

import Stripe from 'stripe'
import { env, hasPaymentGateway } from '@/lib/env'

export const stripe: Stripe | null = hasPaymentGateway
  ? new Stripe(env.STRIPE_SECRET_KEY!, { typescript: true })
  : null