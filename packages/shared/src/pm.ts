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

/** The `pm.generate` job payload (49b): tenant-agnostic, so one daily schedule serves every plant. */
export const pmGeneratePayloadSchema = z
  .object({ v: z.literal(1), horizonDays: z.number().int().min(0).max(3650).default(0) })
  .strict();
export type PmGeneratePayload = z.infer<typeof pmGeneratePayloadSchema>;

const DAY = 86_400_000;

/**
 * The part of a plan the next-due rule needs. `createdAt` is an ISO instant; the plan's clock anchor is its
 * plant-local day, never its UTC day (R2). 49a's settings screen, the calendar and the tests share this rule.
 */
export interface PmDueFields {
  createdAt: string;
  lastDoneOn: string | null;
  intervalDays: number | null;
}

/** The day of an instant in `timeZone`; `en-CA` prints the ISO calendar day, which sorts as text. */
export function plantDayOf(instant: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timeZone ?? 'UTC' }).format(
    new Date(instant),
  );
}

/** The next due day: `last_done_on` else the plant-local anchor, plus the interval; null without one (R2). */
export function pmNextDue(plan: PmDueFields, timeZone?: string): string | null {
  if (!plan.intervalDays || plan.intervalDays <= 0) return null;
  const anchor = plan.lastDoneOn ?? plantDayOf(plan.createdAt, timeZone);
  return addDays(anchor, plan.intervalDays);
}

/**
 * The platform's move window (R4): 15 days when the interval is missing or long enough, otherwise
 * `max(1, min(15, round(15 × interval ÷ 182)))` — a 30-day plan is judged at ±2, a 182-day one at ±15.
 */
export function pmToleranceDays(intervalDays: number | null): number {
  if (intervalDays === null || intervalDays >= 150) return 15;
  return Math.max(1, Math.min(15, Math.round((15 * intervalDays) / 182)));
}

/** A calendar day plus `n` days: calendar arithmetic on the day string, no zone. */
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}

/** A day inside the plan's tolerance window, both ends inclusive (R4). */
export function pmWithinWindow(day: string, dueOn: string, toleranceDays: number): boolean {
  return day >= addDays(dueOn, -toleranceDays) && day <= addDays(dueOn, toleranceDays);
}

/** `GET /api/v1/pm/calendar?from&to`: the grid's range, both ends inclusive plant days. */
export const pmCalendarQuerySchema = z
  .object({ from: calendarDay, to: calendarDay })
  .strict()
  .refine((range) => range.from <= range.to, {
    message: 'from must be on or before to',
    path: ['from'],
  });
export type PmCalendarQuery = z.infer<typeof pmCalendarQuerySchema>;

/** One machine's PM: its effective plan's next due, or the open PM ticket that replaces it (R2). */
export const pmCalendarItemSchema = z
  .object({
    planId: z.string().uuid().nullable(),
    machineId: z.string().uuid(),
    machineCode: z.string().min(1).max(40),
    title: z.string().min(1).max(2000),
    dueOn: calendarDay,
    scheduledOn: calendarDay,
    toleranceDays: z.number().int().min(1).max(3650),
    ticketId: z.string().uuid().nullable(),
    status: z.enum(['planned', 'open']),
    movable: z.boolean(),
    crowded: z.boolean(),
    suggestedOn: calendarDay.nullable(),
  })
  .strict();
export type PmCalendarItem = z.infer<typeof pmCalendarItemSchema>;

export const pmCalendarReplySchema = z
  .object({
    from: calendarDay,
    to: calendarDay,
    today: calendarDay,
    cap: z.number().int().positive(),
    items: z.array(pmCalendarItemSchema),
  })
  .strict();
export type PmCalendarReply = z.infer<typeof pmCalendarReplySchema>;

/** A drag or a "Move to" button: the occurrence (plan and/or open ticket) and the target plant day (R3). */
export const pmRescheduleSchema = z
  .object({
    machineId: z.string().uuid(),
    planId: z.string().uuid().nullable().optional(),
    ticketId: z.string().uuid().nullable().optional(),
    scheduledOn: calendarDay,
  })
  .strict();
export type PmRescheduleBody = z.infer<typeof pmRescheduleSchema>;

export const pmRescheduleReplySchema = z
  .object({
    ticketId: z.string().uuid(),
    ref: z.string().min(1).max(40),
    scheduledOn: calendarDay,
    /** True when the move materialised a new job, false when it moved an open ticket. */
    created: z.boolean(),
  })
  .strict();
export type PmRescheduleReply = z.infer<typeof pmRescheduleReplySchema>;
