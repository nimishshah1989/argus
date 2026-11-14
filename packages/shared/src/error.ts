import { z } from 'zod';
import { lockoutStepSchema, type LockoutStep } from './lockout.js';

export const errorCodeSchema = z.enum([
  'unauthenticated',
  'forbidden',
  'not_found',
  'conflict',
  'validation',
  'rate_limited',
  'not_configured',
  'internal',
  'must_change_password',
  'choose_acting_person',
  'lockout_required',
  'lockout_steps_missing',
  'steps_changed',
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorBodySchema = z
  .object({
    error: z
      .object({
        code: errorCodeSchema,
        message: z.string(),
        field: z.string().optional(),
        /** The plant's current lockout steps, on a refusal that is about them. */
        steps: z.array(lockoutStepSchema).optional(),
      })
      .strict(),
  })
  .strict();
export type ErrorBody = z.infer<typeof errorBodySchema>;

export function apiError(
  code: ErrorCode,
  message: string,
  field?: string,
  steps?: LockoutStep[],
): ErrorBody {
  const error: ErrorBody['error'] = { code, message };
  if (field) error.field = field;
  if (steps) error.steps = steps;
  return { error };
}
