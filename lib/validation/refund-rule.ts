import { z } from 'zod'

/**
 * Phase 57c — the booking form's "I accept the refund policy" checkbox.
 * Only `true` passes; the message is a dictionary key resolved by
 * translateZodIssues (lib/errors/translate.ts). Lives outside the
 * 'use server' file so tests can import it.
 */
export const acceptRefundRuleSchema = z.literal(true, {
  errorMap: () => ({ message: 'validation.acceptRefundRule' }),
})
