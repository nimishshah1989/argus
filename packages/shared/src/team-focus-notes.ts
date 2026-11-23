import { z } from 'zod';
import { isoDateTimeSchema } from './ticket-reply.js';

/**
 * Team Focus notes (ticket TF-1, ADR 0018): what a team saved against one action of one focus month — its status, who
 * owns it and a note. One `setting` row per action, keyed `focus:<period>|<action key>`, where the period is the
 * month the engine's Team Focus figure plans (`YYYY-MM`) and the action key is the engine's own (it may contain `|`).
 */

/** The prefix of every Team Focus note row in `setting`. */
export const FOCUS_PREFIX = 'focus:';

/** The platform's four statuses, its own words: not started, in progress, done, not needed. */
export const FOCUS_STATUSES = ['open', 'prog', 'done', 'skip'] as const;
export const focusStatusSchema = z.enum(FOCUS_STATUSES);
export type FocusStatus = z.infer<typeof focusStatusSchema>;

/** The focus month a note belongs to. */
export const focusPeriodSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use a month like 2026-12');

/** The engine's action key, stored as given. */
export const focusActionKeySchema = z.string().min(1).max(200);

/** `PUT /analytics/team-focus/notes`: save one action's note. Owner and note left out are saved empty. */
export const focusNoteBodySchema = z
  .object({
    period: focusPeriodSchema,
    action: focusActionKeySchema,
    status: focusStatusSchema,
    owner: z.string().max(80).optional(),
    note: z.string().max(500).optional(),
  })
  .strict();
export type FocusNoteBody = z.infer<typeof focusNoteBodySchema>;

/**
 * One stored note and the instant it was saved. Like the nudge acks, the stored text has no length cap (a leaver's
 * name is scrubbed in place, not shortened): the 80/500 limits are the write body's.
 */
export const focusNoteSchema = z
  .object({
    status: focusStatusSchema,
    owner: z.string(),
    note: z.string(),
    at: isoDateTimeSchema,
  })
  .strict();
export type FocusNote = z.infer<typeof focusNoteSchema>;

/** `GET /analytics/team-focus/notes?period=` and the write's answer: the month's notes by action key. */
export const focusNotesReplySchema = z
  .object({
    period: focusPeriodSchema,
    notes: z.record(z.string(), focusNoteSchema),
  })
  .strict();
export type FocusNotesReply = z.infer<typeof focusNotesReplySchema>;

/** The `setting` key one action's note is stored under. */
export const focusRowKey = (period: string, action: string): string =>
  `${FOCUS_PREFIX}${period}|${action}`;
