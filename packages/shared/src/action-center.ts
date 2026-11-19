import { z } from 'zod';
import { calendarDay } from './plant-settings.js';
import { isoDateTimeSchema } from './ticket-reply.js';

/**
 * The Action Center's persisted acknowledgements and the screen's board (ticket 44, packet 44c). One stored ack
 * lives in a `setting` row under `nudge:<platform key>`; the board is the read model the screen calls. The 16
 * rules are the engine's own list, in the platform's order, and every contract here names them by the same words.
 */

/** The 16 rules, in the order the platform raises them. */
export const NUDGE_RULES = [
  'recur',
  'freq',
  'rise',
  'cell',
  'long',
  'spike',
  'good',
  'mttr',
  'hum',
  'shift',
  'team',
  'newm',
  'spares',
  'age',
  'amc',
  'legal',
] as const;
export const nudgeRuleSchema = z.enum(NUDGE_RULES);
export type NudgeRule = z.infer<typeof nudgeRuleSchema>;

/** The four priorities a nudge can carry. */
export const NUDGE_SEVERITIES = ['high', 'med', 'low', 'info'] as const;
export const nudgeSeveritySchema = z.enum(NUDGE_SEVERITIES);
export type NudgeSeverity = z.infer<typeof nudgeSeveritySchema>;

/** The four statuses a card (and the board) shows. */
export const NUDGE_STATUSES = ['open', 'ack', 'snoozed', 'resolved'] as const;
export const nudgeStatusSchema = z.enum(NUDGE_STATUSES);
export type NudgeStatus = z.infer<typeof nudgeStatusSchema>;

/** What the store keeps: the platform's own three words, with `done` where the screen says Resolved. */
export const NUDGE_ACK_STATUSES = ['ack', 'snooze', 'done'] as const;
export const nudgeAckStatusSchema = z.enum(NUDGE_ACK_STATUSES);

/** What the write route accepts: the screen's words, with `resolved` mapped to the stored `done`. */
export const NUDGE_ACTIONS = ['ack', 'snooze', 'resolved'] as const;
export const nudgeActionSchema = z.enum(NUDGE_ACTIONS);
export type NudgeAction = z.infer<typeof nudgeActionSchema>;

/** A note's and an owner's limits (the plan's 80 and 500 characters), enforced on the write body. */
const owner = z.string().max(80);
const note = z.string().max(500);
/** A plant date, or the empty string when the plant sets no due date. */
const due = z.union([calendarDay, z.literal('')]);

/**
 * One stored acknowledgement: the status, who owns it, the plant date it is due, a note and the instant it was saved.
 * A snooze also carries the instant it opens again. The store only ever holds what the write route validated.
 */
export const nudgeAckSchema = z
  .object({
    status: nudgeAckStatusSchema,
    // The stored note is whatever the platform saved (a leaver's name is scrubbed, not shortened): the write
    // route's body is where the 80/500 limits are enforced. A cap here would turn one old long note into a 500.
    owner: z.string(),
    due,
    note: z.string(),
    at: isoDateTimeSchema,
    until: isoDateTimeSchema.optional(),
  })
  .strict();
export type NudgeAckReply = z.infer<typeof nudgeAckSchema>;

/** `PUT /analytics/action-center/nudges/:key`: acknowledge, snooze or resolve a current, open nudge. */
export const nudgeAckBodySchema = z
  .object({
    status: nudgeActionSchema,
    owner: owner.optional(),
    due: due.optional(),
    note: note.optional(),
  })
  .strict();
export type NudgeAckBody = z.infer<typeof nudgeAckBodySchema>;

/**
 * `POST /analytics/action-center/nudges/:key/ticket`: accept a nudge into one linked inspection ticket (52 R17).
 * A nudge that names one machine needs no choice; one that names several needs one of its own machines.
 */
export const nudgeAcceptSchema = z
  .object({
    machineId: z.string().uuid().optional(),
  })
  .strict();
export type NudgeAcceptBody = z.infer<typeof nudgeAcceptSchema>;

/**
 * The ticket an accepted nudge raised: the ticket's id and reference, and whether this call raised it. A second
 * accept names the same ticket (`created:false`) for the nudge key's lifetime.
 */
export const nudgeTicketReplySchema = z
  .object({
    ticketId: z.string().uuid(),
    ref: z.string().min(1),
    created: z.boolean(),
  })
  .strict();
export type NudgeTicketReply = z.infer<typeof nudgeTicketReplySchema>;

/** One board card: the figure's six fields plus its status, evidence, exclusion and stored ack. */
export const boardNudgeSchema = z
  .object({
    key: z.string().min(1),
    rule: nudgeRuleSchema,
    sev: nudgeSeveritySchema,
    title: z.string(),
    machines: z.array(z.string()),
    entries: z.number().int(),
    status: nudgeStatusSchema,
    reopened: z.boolean(),
    /** The latest entry's plant date, or null for a reminder with no evidence. */
    ev: calendarDay.nullable(),
    /** True when every machine the nudge names is out of production data. */
    excluded: z.boolean(),
    ack: nudgeAckSchema.nullable(),
  })
  .strict();
export type BoardNudgeReply = z.infer<typeof boardNudgeSchema>;

/** One "Machines needing attention" row. */
export const actionCenterRiskRowSchema = z
  .object({
    machine: z.string(),
    model: z.string(),
    score: z.number(),
    why: z.string(),
  })
  .strict();

const countSchema = z.number().int().min(0);

/**
 * The screen's read model: every current nudge with its status, the type labels, the status and severity counts and
 * the same risk rows the figure's page prints. It is not a registered figure.
 */
export const actionCenterBoardSchema = z
  .object({
    asOf: calendarDay,
    snoozeDays: z.number(),
    types: z.record(nudgeRuleSchema, z.string()),
    nudges: z.array(boardNudgeSchema),
    counts: z
      .object({ open: countSchema, ack: countSchema, snoozed: countSchema, resolved: countSchema })
      .strict(),
    bySeverity: z
      .object({ high: countSchema, med: countSchema, low: countSchema, info: countSchema })
      .strict(),
    risk: z.array(actionCenterRiskRowSchema),
  })
  .strict();
export type ActionCenterBoardReply = z.infer<typeof actionCenterBoardSchema>;

/** The reply is the board itself: `GET`, the write and the reopen all answer it whole. */
export const actionCenterBoardReplySchema = actionCenterBoardSchema;
