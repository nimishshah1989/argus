import { z } from 'zod';
import { blank, dropBlanks, flag, num } from './form.js';
import { calendarDay } from './plant-settings.js';

/**
 * Contracts for the duty roster and the escalation ladder (ticket 31). Same `CrudPage` shape as the plant
 * settings: `GET` returns `{ items, nextCursor }`, `POST` creates, `PUT /:id` edits and is how a row is
 * switched off (`active`), never `DELETE`. Every field may arrive as text; an empty text means "none".
 */

const id = z.string().uuid();
const nullableId = z.preprocess(blank, id.nullable());
export const ladderLevelSchema = z.enum(['L1', 'L2', 'L3', 'L4', 'vendor']);
const active = z.boolean();

export const rosterCreateSchema = dropBlanks(
  z.object({ date: calendarDay, shiftId: id, personId: id, level: ladderLevelSchema }).strict(),
);
/**
 * A roster line moves only in level: a different day, shift or person is a different line. `active: false`
 * takes the person off that shift (the line is removed and the history keeps who did it).
 */
export const rosterPatchSchema = z
  .object({
    date: calendarDay,
    shiftId: id,
    personId: id,
    level: ladderLevelSchema,
    active: flag,
  })
  .partial()
  .strict();
export const rosterReplySchema = z
  .object({
    id,
    date: calendarDay,
    shiftId: id,
    personId: id,
    level: ladderLevelSchema,
    active,
  })
  .strict();
export type RosterCreate = z.infer<typeof rosterCreateSchema>;
export type RosterPatch = z.infer<typeof rosterPatchSchema>;
export type RosterReply = z.infer<typeof rosterReplySchema>;

export const ESCALATION_TRIGGERS = [
  'ack_missed',
  'restore_missed',
  'pause_overrun',
  'reopened_twice',
  'critical_still_down',
  'handback_unanswered',
] as const;
const trigger = z.enum(ESCALATION_TRIGGERS);
const severity = z.enum(['S1', 'S2', 'S3', 'S4']);
const role = z.preprocess(
  blank,
  z.enum(['technician', 'supervisor', 'head', 'plant_head', 'admin']).nullable(),
);
const channel = z.enum(['push', 'whatsapp']);
const minutes = (max: number) => num(z.number().int().min(0).max(max));
/** The floor of 15 and the pairing with a cap are the plant's rules, answered by the route with a message. */
const repeatMinutes = num(z.number().int().min(0).max(1440).nullable());
const repeatCap = num(z.number().int().min(0).max(50).nullable());

const ruleFields = {
  trigger,
  severityMin: severity,
  level: ladderLevelSchema,
  notifyPersonId: nullableId,
  notifyRole: role,
  channel,
  delayMinutes: minutes(10_080),
  repeatMinutes,
  repeatCap,
};

/** Who is told is a named person or a role, never both: the route names `notifyRole` when it is neither or both. */
export const ruleCreateSchema = dropBlanks(
  z
    .object({ ...ruleFields, active: flag })
    .partial()
    .required({ trigger: true, severityMin: true, level: true })
    .strict(),
);
export const rulePatchSchema = z
  .object({ ...ruleFields, active: flag })
  .partial()
  .strict();
export const ruleReplySchema = z
  .object({
    id,
    ...ruleFields,
    notifyPersonId: id.nullable(),
    notifyRole: z.string().nullable(),
    repeatMinutes: z.number().int().nullable(),
    repeatCap: z.number().int().nullable(),
    active,
  })
  .strict();
export type RuleCreate = z.infer<typeof ruleCreateSchema>;
export type RulePatch = z.infer<typeof rulePatchSchema>;
export type RuleReply = z.infer<typeof ruleReplySchema>;
