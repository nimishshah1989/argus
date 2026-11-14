import { z } from 'zod';
import { num } from './form.js';
import { settingsPage } from './plant-settings.js';

/**
 * Contracts for the analytics engine shell (ticket 37). The plant profile is the legacy platform's constants
 * (answer key `legacy-settings.json` and `action-center.json`), one row of numbers the plant head edits on a
 * generated settings screen (`/analytics-profile`); the engine reads the same numbers as `AnalyticsProfile`.
 */

/** The kinds of row a figure can come from; the face turns a drill target into the list of those rows. */
export const DRILL_TYPES = ['machine', 'ticket', 'move'] as const;
export const drillTypeSchema = z.enum(DRILL_TYPES);
export type DrillType = z.infer<typeof drillTypeSchema>;

interface ProfileField {
  label: string;
  group: 'plant' | 'actionCenter';
  unit: 'hours' | 'days' | 'percent' | 'count' | 'times' | 'years' | 'rupees';
  default: number;
  min: number;
  max: number;
  /** A whole number only; the multipliers (twice as slow) may have a fraction. */
  whole: boolean;
}

/** `[default, least, most]`: the legacy default and the range a sensible plant stays inside. */
type Range = readonly [number, number, number];
const field = (
  group: ProfileField['group'],
  label: string,
  unit: ProfileField['unit'],
  range: Range,
): ProfileField => ({
  label,
  group,
  unit,
  default: range[0],
  min: range[1],
  max: range[2],
  whole: true,
});
const plant = (label: string, unit: ProfileField['unit'], range: Range) =>
  field('plant', label, unit, range);
const ac = (label: string, unit: ProfileField['unit'], range: Range) =>
  field('actionCenter', label, unit, range);
const acFraction = (label: string, range: Range): ProfileField => ({
  ...ac(label, 'times', range),
  whole: false,
});

/**
 * Every number of the profile, with its legacy default and the range a sensible plant stays inside (the range is
 * ours: 422 on anything outside it). `snoozeDays` is the nudge snooze length. Adding a key is additive: the row
 * reply gains a field and a plant that never set it reads the default.
 */
export const PROFILE_FIELDS = {
  hoursPerDay: plant('Production hours per day', 'hours', [20, 1, 24]),
  daysPerYear: plant('Working days per year', 'days', [300, 1, 366]),
  costPerHour: plant('Value of one machine hour', 'rupees', [1800, 0, 100_000_000]),
  efficiencyPct: plant('Energy efficiency factor', 'percent', [20, 0, 100]),
  whyWhyHours: plant('Why-Why candidate threshold', 'hours', [12, 1, 720]),
  acRepeatDays: ac('Recurring fault: window', 'days', [7, 1, 366]),
  acRepeatMinDays: ac('Recurring fault: least days with the fault', 'days', [2, 1, 366]),
  acFreqDays: ac('Frequent breakdowns: window', 'days', [30, 1, 366]),
  acFreqMin: ac('Frequent breakdowns: least count', 'count', [4, 1, 1000]),
  acCellDays: ac('Same cause in a cell: window', 'days', [7, 1, 366]),
  acCellMin: ac('Same cause in a cell: least count', 'count', [5, 1, 1000]),
  acLongDays: ac('Long breakdown: window', 'days', [60, 1, 366]),
  acSpikePct: ac('Plant trend: rise', 'percent', [50, 1, 1000]),
  acSpikeMinHrs: ac('Plant trend: least hours', 'hours', [10, 0, 100_000]),
  acMttrMult: acFraction('Slow repairs: times the plant average', [2, 1, 100]),
  acMttrMin: ac('Slow repairs: least count', 'count', [3, 1, 1000]),
  acMttrDays: ac('Slow repairs: window', 'days', [90, 1, 366]),
  acHumShare: ac('Human mistakes: share', 'percent', [15, 1, 100]),
  acShiftShare: ac('Shift pattern: share', 'percent', [55, 1, 100]),
  acTeamShare: ac('Team workload: share', 'percent', [30, 1, 100]),
  acNewMachDays: ac('New machine: age', 'days', [90, 1, 3660]),
  acNewMachMin: ac('New machine: least count', 'count', [2, 1, 1000]),
  acSpareDays: ac('Spares spend: window', 'days', [90, 1, 366]),
  acSpareShare: ac('Spares spend: share', 'percent', [25, 1, 100]),
  acRiseMult: acFraction('Worsening machine: times the earlier rate', [2, 1, 100]),
  acRiseMin: ac('Worsening machine: least count', 'count', [3, 1, 1000]),
  acOldAge: ac('Ageing machines: age', 'years', [15, 1, 100]),
  acSnoozeDays: ac('Snooze length', 'days', [7, 1, 90]),
  acPmDays: ac('PM overdue: window', 'days', [90, 1, 366]),
  acNoCodePct: ac('No maintenance code: share', 'percent', [20, 1, 100]),
  acGapDays: ac('Data gap: days', 'days', [3, 1, 366]),
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

/** The edit a generated form sends: any of the profile's numbers, as text or as numbers. */
export const profilePatchSchema = z.object(shape).partial().strict();
export type ProfilePatch = z.infer<typeof profilePatchSchema>;

const id = z.string().uuid();

/** The one profile row (`GET /analytics-profile` lists it, `PUT /analytics-profile/:id` edits it). */
export const profileReplySchema = z
  .object({ id, ...shape, active: z.literal(true) } as Record<string, z.ZodTypeAny>)
  .strict();
export const profilePageSchema = settingsPage(profileReplySchema);

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
    /** The value of one machine hour is money: null for anyone but heads and admin. */
    profile: z.object({ ...shape, costPerHour: z.number().nullable() }).strict(),
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
    figures: z.array(figureReplySchema),
  })
  .strict();
export type FiguresReply = z.infer<typeof figuresReplySchema>;
