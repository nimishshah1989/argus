import { z } from 'zod';
import { isoDateTimeSchema } from './ticket-reply.js';

/**
 * Ticket 66: the steps a technician confirms before work starts on a ticket flagged "needs lockout". The plant
 * edits them as the `lockout_step` list (labels in English, Gujarati, Hindi). While the plant has no active
 * step these four apply, so a flagged ticket is never started on an empty checklist. Proposed wording, for the
 * maintenance head to change.
 */
export const DEFAULT_LOCKOUT_STEPS = [
  { code: 'isolate', label: 'Switch off and isolate the supply' },
  { code: 'lock_tag', label: 'Lock and tag the isolator' },
  { code: 'test_dead', label: 'Test that it is dead' },
  { code: 'tell_nearby', label: 'Tell the people nearby' },
] as const;

/** The lists whose entries can say "needs lockout": what a ticket carries at Start (work type) or its report (category). */
export const LOCKOUT_FLAG_LISTS = ['work_type', 'breakdown_category'] as const;

const step = z
  .object({
    code: z.string(),
    label: z.string(),
    labelGu: z.string().nullable(),
    labelHi: z.string().nullable(),
  })
  .strict();
export type LockoutStep = z.infer<typeof step>;

/**
 * What a ticket's reply says about lockout, on the ticket detail and on a command's reply (not on lists or
 * `/state`): `null` unless the ticket is open and needs a lockout before Start; then the steps to tick and who
 * confirmed them and when, once someone has.
 */
export const lockoutSchema = z
  .object({
    steps: z.array(step),
    confirmed: z
      .object({ at: isoDateTimeSchema, byPersonId: z.string().nullable() })
      .strict()
      .nullable(),
  })
  .strict();
export type Lockout = z.infer<typeof lockoutSchema>;

/** Every step is confirmed in one call; the codes must be exactly the plant's active steps. */
export const lockoutConfirmSchema = z.object({
  personId: z.string().uuid(),
  stepCodes: z.array(z.string().min(1).max(60)).min(1).max(30),
});
export type LockoutConfirmBody = z.infer<typeof lockoutConfirmSchema>;
