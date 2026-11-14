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
  'reopen_blocked',
  'other_cell',
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
        /** On a resume refused for the lockout: the people still to confirm. */
        missing: z.array(z.string()).optional(),
        /** On a dispute refused because the machine has a new open breakdown: that ticket. */
        openTicket: z
          .object({ ticketId: z.string(), ref: z.string(), reportedAt: z.string() })
          .strict()
          .optional(),
        /** On a sign-off refused to an operator from another cell: the machine's cell and the login's, null when none. */
        machineCell: z.string().nullable().optional(),
        loginCell: z.string().nullable().optional(),
      })
      .strict(),
  })
  .strict();
export type ErrorBody = z.infer<typeof errorBodySchema>;

export type ErrorExtra = Pick<
  NonNullable<ErrorBody['error']>,
  'openTicket' | 'machineCell' | 'loginCell'
> & { steps?: LockoutStep[]; missing?: string[] };

export function apiError(
  code: ErrorCode,
  message: string,
  field?: string,
  extra: ErrorExtra = {},
): ErrorBody {
  const error: ErrorBody['error'] = { code, message };
  if (field) error.field = field;
  if (extra.steps) error.steps = extra.steps;
  if (extra.missing) error.missing = extra.missing;
  if (extra.openTicket) error.openTicket = extra.openTicket;
  if (extra.machineCell !== undefined) error.machineCell = extra.machineCell;
  if (extra.loginCell !== undefined) error.loginCell = extra.loginCell;
  return { error };
}
