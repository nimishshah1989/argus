import { z } from 'zod';
import { num } from './form.js';
import { calendarDay, settingsPage } from './plant-settings.js';
import { isoDateTimeSchema, ticketKindSchema, ticketStatusSchema } from './ticket-reply.js';

/**
 * Contracts for the analytics engine shell (ticket 37). The plant profile is the legacy platform's own numbers,
 * under the legacy platform's own key names so the engines read them as the answer key does. It is one row the
 * maintenance head edits on a settings screen (`/analytics-profile`); the engine reads the same numbers as
 * `AnalyticsProfile`.
 */

/** The kinds of row a figure can come from; the face turns a drill target into the list of those rows. */
export const DRILL_TYPES = ['machine', 'ticket', 'move'] as const;
export const drillTypeSchema = z.enum(DRILL_TYPES);
export type DrillType = z.infer<typeof drillTypeSchema>;

interface ProfileField {
  label: string;
  group: 'plant' | 'forecast' | 'money' | 'actionCenter';
  unit: 'hours' | 'days' | 'percent' | 'count' | 'times' | 'years' | 'rupees' | 'number';
  default: number;
  min: number;
  max: number;
  /** A whole number only; the multipliers (twice as slow) may have a fraction. */
  whole: boolean;
  /** Money (DOMAIN section 3): shown only to heads and admin. */
  money: boolean;
  /** The ticket whose engine reads it. */
  owner: number;
}

/** `[default, least, most]`: the legacy default and the range a sensible plant stays inside (the range is ours). */
type Range = readonly [number, number, number];
interface Spec {
  group?: ProfileField['group'];
  owner?: number;
  money?: true;
  fraction?: true;
}
const field = (
  label: string,
  unit: ProfileField['unit'],
  range: Range,
  spec: Spec = {},
): ProfileField => ({
  label,
  unit,
  default: range[0],
  min: range[1],
  max: range[2],
  whole: !spec.fraction,
  money: spec.money === true,
  group: spec.group ?? 'actionCenter',
  owner: spec.owner ?? 44,
});
const plant = (label: string, unit: ProfileField['unit'], range: Range, owner = 38) =>
  field(label, unit, range, { group: 'plant', owner });
const money = (label: string, unit: ProfileField['unit'], range: Range) =>
  field(label, unit, range, { group: 'money', owner: 43, money: true });

/**
 * Every number of the profile, under its legacy key, with its legacy default (answer key) and the range a sensible
 * plant stays inside (422 outside it). The Action Center keys are the legacy `ac` object, `snoozeDays` the nudge
 * snooze. Adding a key is additive: the row reply gains a field and a plant that never set it reads the default.
 * Not sure of their unit (legacy names only): `flHalfLife`, `mmTurnover`, `mmSucc`; their ranges are wide on
 * purpose and tickets 42 and 43 tighten them.
 */
export const PROFILE_FIELDS = {
  prodHrsPerDay: plant('Production hours per day', 'hours', [20, 1, 24]),
  workDaysPerYear: plant('Working days per year', 'days', [300, 1, 366]),
  efficiencyFactor: plant('Energy efficiency factor', 'percent', [20, 0, 100], 41),
  whyWhyThresholdHours: plant('Why-Why candidate threshold', 'hours', [12, 1, 720], 41),
  flHalfLife: field('Forecast half-life', 'days', [300, 1, 3660], { group: 'forecast', owner: 42 }),
  mmThroughput: money('Throughput per machine hour', 'rupees', [1800, 0, 100_000_000]),
  mmTurnover: money('Money Matters turnover', 'number', [150, 0, 1_000_000_000]),
  mmSucc: money('Money Matters success figure', 'number', [100, 0, 1_000_000]),
  repeatDays: field('Recurring fault: window', 'days', [7, 1, 366]),
  repeatMinDays: field('Recurring fault: least days with the fault', 'days', [2, 1, 366]),
  freqDays: field('Frequent breakdowns: window', 'days', [30, 1, 366]),
  freqMin: field('Frequent breakdowns: least count', 'count', [4, 1, 1000]),
  cellDays: field('Same cause in a cell: window', 'days', [7, 1, 366]),
  cellMin: field('Same cause in a cell: least count', 'count', [5, 1, 1000]),
  longDays: field('Long breakdown: window', 'days', [60, 1, 366]),
  spikePct: field('Plant trend: rise', 'percent', [50, 1, 1000]),
  spikeMinHrs: field('Plant trend: least hours', 'hours', [10, 0, 100_000]),
  mttrMult: field('Slow repairs: times the plant average', 'times', [2, 1, 100], {
    fraction: true,
  }),
  mttrMin: field('Slow repairs: least count', 'count', [3, 1, 1000]),
  mttrDays: field('Slow repairs: window', 'days', [90, 1, 366]),
  humShare: field('Human mistakes: share', 'percent', [15, 1, 100]),
  shiftShare: field('Shift pattern: share', 'percent', [55, 1, 100]),
  teamShare: field('Team workload: share', 'percent', [30, 1, 100]),
  newMachDays: field('New machine: age', 'days', [90, 1, 3660]),
  newMachMin: field('New machine: least count', 'count', [2, 1, 1000]),
  spareDays: field('Spares spend: window', 'days', [90, 1, 366]),
  spareShare: field('Spares spend: share', 'percent', [25, 1, 100]),
  riseMult: field('Worsening machine: times the earlier rate', 'times', [2, 1, 100], {
    fraction: true,
  }),
  riseMin: field('Worsening machine: least count', 'count', [3, 1, 1000]),
  oldAge: field('Ageing machines: age', 'years', [15, 1, 100]),
  snoozeDays: field('Snooze length', 'days', [7, 1, 90]),
  pmDays: field('PM overdue: window', 'days', [90, 1, 366]),
  noCodePct: field('No maintenance code: share', 'percent', [20, 1, 100]),
  gapDays: field('Data gap: days', 'days', [3, 1, 366]),
} as const satisfies Record<string, ProfileField>;

export type ProfileKey = keyof typeof PROFILE_FIELDS;
export type AnalyticsProfile = { readonly [K in ProfileKey]: number };
export const PROFILE_KEYS = Object.keys(PROFILE_FIELDS) as ProfileKey[];

export const DEFAULT_PROFILE: AnalyticsProfile = Object.freeze(
  Object.fromEntries(PROFILE_KEYS.map((key) => [key, PROFILE_FIELDS[key].default])),
) as AnalyticsProfile;

function fieldSchema(field: ProfileField) {
  const base = z.number().min(field.min).max(field.max);
  return num(field.whole ? base.int() : base);
}

const shape = Object.fromEntries(
  PROFILE_KEYS.map((key) => [key, fieldSchema(PROFILE_FIELDS[key])]),
);

/**
 * The edit a generated form sends: any of the profile's numbers, as text or as numbers. A `CrudPage` Save also sends
 * the row's `active` back; the profile is one row that is always on, so only `true` is accepted and it changes nothing.
 */
export const profilePatchSchema = z
  .object({ ...shape, active: z.preprocess((v) => (v === 'true' ? true : v), z.literal(true)) })
  .partial()
  .strict();
export type ProfilePatch = z.infer<typeof profilePatchSchema>;

/** A pair of numbers that cannot both be true; names the field to correct. Null when the profile is sensible. */
export function profileRuleProblem(
  profile: Readonly<Record<string, unknown>>,
): { field: ProfileKey; message: string } | null {
  const n = (key: ProfileKey) => Number(profile[key]);
  if (n('repeatMinDays') > n('repeatDays')) {
    return { field: 'repeatMinDays', message: 'Cannot be more than the recurring fault window' };
  }
  if (n('newMachDays') >= n('oldAge') * 365) {
    return { field: 'newMachDays', message: 'A new machine must be younger than an ageing one' };
  }
  return null;
}

const id = z.string().uuid();

/**
 * The one profile row. This is a SINGLE-ROW settings resource: `GET /analytics-profile` lists that one row,
 * `PUT /analytics-profile/:id` edits it, and there is no add and no switch off (`POST` is 404, `active: false` 422).
 */
export const profileReplySchema = z
  .object({ id, ...shape, active: z.literal(true) } as Record<string, z.ZodTypeAny>)
  .strict();
export const profilePageSchema = settingsPage(profileReplySchema);

/** The profile as the figures reply carries it: the money numbers are null for anyone but heads and admin. */
const replyProfile = Object.fromEntries(
  PROFILE_KEYS.map((key) => [
    key,
    PROFILE_FIELDS[key].money ? z.number().nullable() : fieldSchema(PROFILE_FIELDS[key]),
  ]),
);

const figureKey = z.string().min(1);

export const figureReplySchema = z
  .object({
    key: figureKey,
    screen: z.string().min(1),
    /** The ticket that owns the computation (38 to 45). */
    owner: z.number().int(),
    status: z.enum(['ready', 'not_computed']),
    value: z.unknown().nullable(),
    drill: z.object({ type: drillTypeSchema, ids: z.array(id) }).strict(),
  })
  .strict();

/** `GET /analytics/figures`: what the engine says as of one plant date, with the profile it used. */
export const figuresReplySchema = z
  .object({
    asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    profile: z.object(replyProfile).strict(),
    rows: z
      .object({
        machines: z.number().int(),
        moves: z.number().int(),
        tickets: z.number().int(),
        tasks: z.number().int(),
        reports: z.number().int(),
        people: z.number().int(),
      })
      .strict(),
    /** How many machines the plant leaves out of production data (tickets 77a and 77b); the server always sends it. */
    excludedMachines: z.number().int().min(0),
    figures: z.array(figureReplySchema),
  })
  .strict();
export type FiguresReply = z.infer<typeof figuresReplySchema>;

/** How many ids one drill-down may ask for: a screen's worth of rows, still one read of the plant. */
export const MAX_DRILL_IDS = 200;

const drillText = z.string().nullable();

/**
 * A figure's drill target, as the engine reads it: a machine, a ticket or a cell move, plain and with no table
 * names. It is the same row the engine computed from, so the screen shows what the number counted.
 */
export const machineDrillRowSchema = z
  .object({
    id,
    code: z.string(),
    segment: drillText,
    category: drillText,
    cell: drillText,
    location: drillText,
    make: drillText,
    model: drillText,
    serial: drillText,
    controller: drillText,
    controllerModel: drillText,
    controllerSerial: drillText,
    year: z.number().int().nullable(),
    purchasedOn: calendarDay.nullable(),
    powerKw: z.number().nullable(),
    capacityKva: z.number().nullable(),
    assetCode: drillText,
    status: z.enum(['active', 'idle', 'scrapped']),
    criticality: z.enum(['A', 'B', 'C']).nullable(),
    excludedFromProduction: z.boolean(),
    metadata: z.record(z.unknown()),
  })
  .strict();

export const ticketDrillRowSchema = z
  .object({
    id,
    ref: z.string(),
    kind: ticketKindSchema,
    status: ticketStatusSchema,
    machineId: id.nullable(),
    reportedAt: isoDateTimeSchema,
    closedAt: isoDateTimeSchema.nullable(),
    source: z.enum(['live', 'history']),
    downtimeMin: z.number().int().nullable(),
    repairMin: z.number().int().nullable(),
    workType: drillText,
  })
  .strict();

export const moveDrillRowSchema = z
  .object({
    id,
    machineId: id,
    fromCell: drillText,
    toCell: drillText,
    fromLocation: drillText,
    toLocation: drillText,
    effectiveFrom: calendarDay,
  })
  .strict();

export const drillReplyRowSchema = z.union([
  machineDrillRowSchema,
  ticketDrillRowSchema,
  moveDrillRowSchema,
]);
export type DrillReplyRow = z.infer<typeof drillReplyRowSchema>;

/** `GET /analytics/drill?type=machine&ids=<id>,<id>`: the ids arrive as one comma-separated list. */
export const drillQuerySchema = z
  .object({
    type: drillTypeSchema,
    ids: z
      .string()
      .transform((raw) =>
        raw
          .split(',')
          .map((part) => part.trim())
          .filter((part) => part !== ''),
      )
      .pipe(z.array(id).min(1).max(MAX_DRILL_IDS)),
  })
  .strict();
export type DrillQuery = z.infer<typeof drillQuerySchema>;

/** The rows a figure drills to, in the order they were asked; ids of another plant or another type are dropped. */
export const drillReplySchema = z
  .object({ type: drillTypeSchema, rows: z.array(drillReplyRowSchema) })
  .strict();
export type DrillReply = z.infer<typeof drillReplySchema>;
