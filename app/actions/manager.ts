'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth/require'
import {
  resolveDamageReport,
  approveRefund,
  rejectRefund,
} from '@/lib/data/manager'

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

export async function resolveDamageReportAction(formData: FormData): Promise<ActionResult> {
  const session = await requireRole(['manager', 'admin'], '/manager')

  const reportId = String(formData.get('reportId') ?? '').trim()
  const costRaw = String(formData.get('costEstimate') ?? '').trim()
  const note = String(formData.get('resolutionNote') ?? '').trim().slice(0, 500)

  if (!reportId) return { ok: false, error: 'Missing report id' }
  const costEstimate = Number(costRaw)
  if (!Number.isFinite(costEstimate) || costEstimate < 0) {
    return { ok: false, error: 'Cost estimate must be a non-negative number' }
  }
  if (!note) return { ok: false, error: 'Please add a resolution note' }

  try {
    await resolveDamageReport({
      reportId,
      costEstimate,
      resolutionNote: note,
      // Phase 9B: store the actor's profile UUID in damage_reports.resolved_by (FK).
      // The display label is resolved in the SELECT join inside the data layer.
      resolvedBy: session.id,
    })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not resolve report' }
  }

  revalidatePath('/manager')
  revalidatePath('/manager/housekeeping')
  return { ok: true }
}

export async function approveRefundAction(formData: FormData): Promise<ActionResult> {
  await requireRole(['manager', 'admin'], '/manager')

  const refundId = String(formData.get('refundId') ?? '').trim()
  if (!refundId) return { ok: false, error: 'Missing refund id' }

  try {
    await approveRefund({ refundId })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not approve refund' }
  }

  revalidatePath('/manager')
  revalidatePath('/manager/bookings')
  return { ok: true }
}

export async function rejectRefundAction(formData: FormData): Promise<ActionResult> {
  await requireRole(['manager', 'admin'], '/manager')

  const refundId = String(formData.get('refundId') ?? '').trim()
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 500)
  if (!refundId) return { ok: false, error: 'Missing refund id' }
  if (!reason) return { ok: false, error: 'Please provide a rejection reason' }

  try {
    await rejectRefund({ refundId, reason })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not reject refund' }
  }

  revalidatePath('/manager')
  revalidatePath('/manager/bookings')
  return { ok: true }
}
