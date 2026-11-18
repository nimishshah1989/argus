import { z } from 'zod';
import { blank, dropBlanks, flag, num } from './form.js';
import { calendarDay } from './plant-settings.js';

/**
 * The PM plan contracts (ticket 49, D17): one recurring plan per machine or category, with the checklist as a
 * numbered list on the row. Same `CrudPage` shape as the plant settings: `GET` returns `{ items, nextCursor }`,
 * `POST` creates, `PUT /:id` edits and is how a plan is switched off (`active`), never `DELETE`. A generated
 * form sends every field as text; an empty text means "none".
 */

const id = z.string().uuid();
const text = z.string().trim().max(120).nullable();
const nullableId = z.preprocess(blank, id.nullable());
const title = z.string().trim().min(1).max(200);
const positiveDays = num(z.number().int().positive().max(3650));
const positiveNumber = num(z.number().positive().nullable());
const nonNegativeNumber = num(z.number().min(0).nullable());
const reading = num(z.number().nullable());
const nullableDay = z.preprocess(blank, calendarDay.nullable());

/** A tick point carries no text: the phone renders "Point N" through i18n. */
export const pmChecklistItemSchema = z.discriminatedUnion('kind', [
  z
    .object({ id: z.string().min(1), kind: z.literal('tick'), point: z.number().int().positive() })
    .strict(),
  z
    .object({
      id: z.string().min(1),
      kind: z.literal('reading'),
      point: z.number().int().positive(),
      metric: z.string().min(1).max(20),
      label: z.string().min(1).max(120),
      unit: z.literal('mm'),
    })
    .strict(),
]);
export type PmChecklistItem = z.infer<typeof pmChecklistItemSchema>;

/** The platform's measurement names are data (R5): the workbook stores the key, the phone shows the name. */
export const PM_MEASUREMENT_LABELS: Record<string, string> = {
  bx: 'Backlash X',
  by: 'Backlash Y',
  bz: 'Backlash Z',
  tx: 'Taper X',
  tz: 'Taper Z',
  txz: 'Taper XZ',
  tyz: 'Taper YZ',
  txy: 'Taper XY',
  sr: 'Spindle run out',
  tc: 'Tail stock centre',
  rb: 'Rotary B backlash',
  ra: 'Rotary A backlash',
  rr: 'Rotary run out',
  ra2: 'Rotary A run out',
  rb2: 'Rotary B run out',
  td: 'Tool disc',
  cr: 'Chuck run out',
};

const planFields = {
  title,
  machineId: nullableId,
  category: text,
  intervalDays: positiveDays,
  meterInterval: positiveNumber,
  meterTolerance: nonNegativeNumber,
  lastMeterReading: reading,
  lastDoneOn: nullableDay,
};

/** A plan always has an interval: the meter is an additional trigger, never the only one (R6). */
export const pmPlanCreateSchema = dropBlanks(
  z
    .object({ ...planFields, active: flag })
    .partial()
    .required({ title: true, intervalDays: true })
    .strict(),
);
export const pmPlanPatchSchema = z
  .object({ ...planFields, active: flag })
  .partial()
  .strict();

export const pmPlanReplySchema = z
  .object({
    id,
    title,
    machineId: id.nullable(),
    category: text,
    intervalDays: z.number().int().nullable(),
    meterInterval: z.number().nullable(),
    meterTolerance: z.number().nullable(),
    lastMeterReading: z.number().nullable(),
    lastDoneOn: calendarDay.nullable(),
    checklist: z.array(pmChecklistItemSchema),
    active: z.boolean(),
    /** The plan's clock anchor, not its insertion time; an imported plan may start in the future (R2). */
    createdAt: z.string().datetime(),
  })
  .strict();
export type PmPlanReply = z.infer<typeof pmPlanReplySchema>;

/** What a ticket's detail carries for a PM job: the effective plan (R3) and its checklist. */
export const pmPlanForJobSchema = pmPlanReplySchema.omit({ createdAt: true });
export type PmPlanForJob = z.infer<typeof pmPlanForJobSchema>;
