import { z } from 'zod';

/** One closed ticket still waiting for production to confirm or dispute the fix. */
export const signoffFeedItemSchema = z
  .object({
    ticketId: z.string(),
    ref: z.string(),
    machine: z.object({ id: z.string(), code: z.string().nullable() }).strict().nullable(),
    /** The cell the machine was in when the ticket was reported, null when it had none. */
    cell: z.string().nullable(),
    closedAt: z.string(),
    /** When production was asked: the same instant as the close. */
    requestedAt: z.string(),
    /** When the time to answer runs out, null when the plant sets no limit. */
    dueAt: z.string().nullable(),
  })
  .strict();

/** One answered or timed-out sign-off: production confirmed the fix, sent it back, or did not answer in time. */
export const signoffOutcomeSchema = z
  .object({
    ticketId: z.string(),
    ref: z.string(),
    machine: z.object({ id: z.string(), code: z.string().nullable() }).strict().nullable(),
    cell: z.string().nullable(),
    status: z.enum(['confirmed', 'disputed', 'timed_out']),
    /** When production was asked: the close the outcome is about. */
    requestedAt: z.string(),
    /** When production answered, or when the time to answer ran out. */
    at: z.string(),
    /** Who answered; null when nobody did (timed out). */
    byPersonId: z.string().nullable(),
    /** A dispute's reason; null otherwise. */
    reason: z.string().nullable(),
  })
  .strict();
export type SignoffOutcome = z.infer<typeof signoffOutcomeSchema>;

/**
 * `GET /board/signoff`: `items` oldest close first (the longest wait at the top), at most `SIGNOFF_FEED_MAX`;
 * `outcomes` the sign-offs answered or timed out in the last `SIGNOFF_OUTCOME_HOURS`, newest first, at most
 * `SIGNOFF_FEED_MAX`.
 */
export const signoffFeedReplySchema = z
  .object({ items: z.array(signoffFeedItemSchema), outcomes: z.array(signoffOutcomeSchema) })
  .strict();
export type SignoffFeed = z.infer<typeof signoffFeedReplySchema>;
export const SIGNOFF_FEED_MAX = 50;
export const SIGNOFF_OUTCOME_HOURS = 24;
