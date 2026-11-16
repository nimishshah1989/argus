import { z } from 'zod';
import { isoDateTimeSchema } from './ticket-reply.js';

/**
 * Ticket 66: the steps a technician confirms before work starts on a ticket flagged "needs lockout". The plant
 * edits them as the `lockout_step` list (labels in English, Gujarati, Hindi). A plant that has none yet is given
 * these four as ordinary rows the first time they are read, and an edited list is never overwritten. Proposed
 * wording, for the maintenance head to change.
 */
export const DEFAULT_LOCKOUT_STEPS = [
  { code: 'isolate', label: 'Switch off and isolate the supply' },
  { code: 'lock_tag', label: 'Lock and tag the isolator' },
  { code: 'test_dead', label: 'Test that it is dead' },
  { code: 'tell_nearby', label: 'Tell the people nearby' },
] as const;

/** The lists whose entries can say "needs lockout": what a ticket carries at Start (work type) or its report (category). */
export const LOCKOUT_FLAG_LISTS = ['work_type', 'breakdown_category'] as const;

export const lockoutStepSchema = z
  .object({
    code: z.string(),
    label: z.string(),
    labelGu: z.string().nullable(),
    labelHi: z.string().nullable(),
  })
  .strict();
export type LockoutStep = z.infer<typeof lockoutStepSchema>;

/**
 * What a ticket's reply says about lockout, on a raise, the ticket detail, a command's reply, a list reply
 * (`/tickets`) and `/state`: `null` unless the ticket is live and flagged "needs lockout". Then the steps to
 * tick and who stands confirmed now. A confirmation belongs to one person and is cleared when the ticket is
 * paused, handed over, closed, cancelled, restored or reopened, so an empty list on a flagged ticket means
 * "confirm before you touch it".
 */
export const lockoutSchema = z
  .object({
    steps: z.array(lockoutStepSchema),
    confirmations: z.array(
      z.object({ at: isoDateTimeSchema, byPersonId: z.string().nullable() }).strict(),
    ),
  })
  .strict();
export type Lockout = z.infer<typeof lockoutSchema>;

/** Every step is confirmed in one call; the codes must be exactly the plant's active steps. */
export const lockoutConfirmSchema = z.object({
  /** The session's own person; naming anyone else is refused (403). */
  personId: z.string().uuid().optional(),
  stepCodes: z.array(z.string().min(1).max(60)).min(1).max(30),
});
export type LockoutConfirmBody = z.infer<typeof lockoutConfirmSchema>;
