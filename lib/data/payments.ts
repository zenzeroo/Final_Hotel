/**
 * Phase 17 — Payments data-layer dispatcher (Pattern A).
 *
 * Mirrors `lib/data/manager.ts` exactly. Toggle evaluated at module load —
 * changing `USE_MOCK_DATA` env requires `npm run dev` restart
 * (`zenzero-usemock-data-wrapper` pitfall).
 */

import * as mock from './mock-payments'
import * as real from './supabase-payments'
import { hasSupabase, isUsingMockData } from '@/lib/env'

const useMock = isUsingMockData || !hasSupabase

export const createPaymentSession = useMock
  ? mock.createPaymentSession
  : real.createPaymentSession

export const getPaymentBySessionId = useMock
  ? mock.getPaymentBySessionId
  : real.getPaymentBySessionId

export const listPaymentsByBooking = useMock
  ? mock.listPaymentsByBooking
  : real.listPaymentsByBooking

export const updatePaymentSessionId = useMock
  ? mock.updatePaymentSessionId
  : real.updatePaymentSessionId