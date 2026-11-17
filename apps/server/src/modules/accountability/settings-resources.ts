import type { PoolClient } from 'pg';
import { canSettingsSla } from '@uptimo/domain';
import {
  calendarDay,
  rosterCreateSchema,
  rosterPatchSchema,
  ruleCreateSchema,
  rulePatchSchema,
} from '@uptimo/shared';
import { lockActivePerson } from '../identity/index.js';
import { plantToday, shiftIsOn, type Problem, type Resource } from '../plant/index.js';
import { ensureEscalationDefaults, ROSTER_KEEP_DAYS, shiftDay } from './ladder.js';
import { rosterStore, ruleStore } from './repo/ladder.js';

type Reply = Record<string, unknown>;
type Row = Record<string, unknown>;

const pad = (n: number) => String(n).padStart(2, '0');
/** A `date` column reaches us as a Date at local midnight (the driver builds it that way), so read it back locally. */
const isoDay = (value: unknown): string =>
  value instanceof Date
    ? `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
    : String(value);

const DEFAULT_BACK_DAYS = 7;
const DEFAULT_AHEAD_DAYS = 35;
const MAX_SPAN_DAYS = 120;
const DAY_MS = 86_400_000;

/** `?from&to` (plant dates), by default a week back to five weeks ahead; at most 120 days in one call. */
async function rosterWindow(
  tx: PoolClient,
  tenantId: string,
  query: Record<string, unknown>,
): Promise<Problem | { from: string; to: string }> {
  const today = await plantToday(tx, tenantId);
  const from = query.from ?? shiftDay(today, -DEFAULT_BACK_DAYS);
  const to = query.to ?? shiftDay(today, DEFAULT_AHEAD_DAYS);
  for (const [field, value] of [
    ['from', from],
    ['to', to],
  ] as const) {
    if (!calendarDay.safeParse(value).success) {
      return { field, message: 'Use a date like 2026-11-14' };
    }
  }
  const [first, last] = [from as string, to as string];
  if (last < first) return { field: 'from', message: 'From must not be after to' };
  const span = (Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / DAY_MS;
  if (span > MAX_SPAN_DAYS) {
    return { field: 'to', message: `Ask for at most ${MAX_SPAN_DAYS} days at a time` };
  }
  return { from: first, to: last };
}

/**
 * A new roster line names a shift that is on and a person who is on. A line older than the one-year purge would
 * vanish the same night, and one more than a year ahead is a typo.
 */
async function checkRosterLine(
  tx: PoolClient,
  line: Reply,
  edit: unknown,
  tenantId: string,
): Promise<Problem | null> {
  if (edit) return null;
  const on = await shiftIsOn(tx, line.shiftId as string);
  if (on === undefined) return { field: 'shiftId', message: 'Unknown shift' };
  if (!on) return { field: 'shiftId', message: 'That shift is switched off' };
  if (!(await lockActivePerson(tx, tenantId, line.personId as string)))
    return { field: 'personId', message: 'Unknown person' };
  const today = await plantToday(tx, tenantId);
  if ((line.date as string) < shiftDay(today, -ROSTER_KEEP_DAYS))
    return { field: 'date', message: 'Roster lines older than a year are not kept' };
  if ((line.date as string) > shiftDay(today, 366))
    return { field: 'date', message: 'That date is more than a year ahead' };
  return null;
}

export const roster: Resource = {
  path: 'roster',
  table: 'roster_entry',
  kind: 'roster',
  order: 'date DESC, shift_id, level, person_id',
  columns: { date: 'date', shiftId: 'shift_id', personId: 'person_id', level: 'level' },
  fixed: ['date', 'shiftId', 'personId'],
  create: rosterCreateSchema,
  patch: rosterPatchSchema,
  reply: (row: Row) => ({
    id: row.id,
    date: isoDay(row.date),
    shiftId: row.shift_id,
    personId: row.person_id,
    level: row.level,
    active: true,
  }),
  store: rosterStore,
  listFilter: rosterWindow,
  uniqueField: 'personId',
  taken: 'That person is already on this shift that day',
  can: canSettingsSla,
  check: checkRosterLine,
};

const REPEAT_FLOOR = 15;

/** The two repeat values come as a pair, every `repeatMinutes` (15 at least) at most `repeatCap` times. */
function checkRepeat(rule: Reply): Problem | null {
  const every = (rule.repeatMinutes as number | null | undefined) ?? null;
  const cap = (rule.repeatCap as number | null | undefined) ?? null;
  if (every === null && cap === null) return null;
  if (every === null)
    return {
      field: 'repeatMinutes',
      message: `Say how often to repeat, at least every ${REPEAT_FLOOR} minutes`,
    };
  if (every < REPEAT_FLOOR)
    return { field: 'repeatMinutes', message: `Repeat at most every ${REPEAT_FLOOR} minutes` };
  if (cap === null || cap < 1)
    return { field: 'repeatCap', message: 'Say how many times to repeat (at least 1)' };
  return null;
}

/** A rule tells a named person or a role: exactly one of the two. */
function checkWho(rule: Reply): Problem | null {
  const one = (rule.notifyPersonId == null) !== (rule.notifyRole == null);
  return one
    ? null
    : {
        field: 'notifyRole',
        message: 'Choose a role or a person to tell, not both and not neither',
      };
}

/** WhatsApp is built in M3: the screen offers push only and the route refuses a rule that says otherwise. */
function checkChannel(rule: Reply): Problem | null {
  // A new rule that names no channel takes the column's default, which is push.
  return (rule.channel ?? 'push') === 'push'
    ? null
    : { field: 'channel', message: 'WhatsApp arrives in M3; escalation is push only for now' };
}

async function checkRule(
  tx: PoolClient,
  rule: Reply,
  edit: { patch: Reply } | undefined,
  tenantId: string,
): Promise<Problem | null> {
  const problem = checkWho(rule) ?? checkChannel(rule) ?? checkRepeat(rule);
  if (problem) return problem;
  const person = (rule.notifyPersonId as string | null | undefined) ?? null;
  if (
    person &&
    (!edit || 'notifyPersonId' in edit.patch) &&
    !(await lockActivePerson(tx, tenantId, person))
  )
    return { field: 'notifyPersonId', message: 'Unknown person' };
  return null;
}

export const rules: Resource = {
  path: 'escalation-rules',
  table: 'escalation_rule',
  kind: 'escalation_rule',
  order: 'trigger, severity_min, level, notify_role NULLS LAST, id',
  columns: {
    trigger: 'trigger',
    severityMin: 'severity_min',
    level: 'level',
    notifyPersonId: 'notify_person_id',
    notifyRole: 'notify_role',
    channel: 'channel',
    delayMinutes: 'delay_minutes',
    repeatMinutes: 'repeat_minutes',
    repeatCap: 'repeat_cap',
    active: 'active',
  },
  create: ruleCreateSchema,
  patch: rulePatchSchema,
  reply: (row: Row) => ({
    id: row.id,
    trigger: row.trigger,
    severityMin: row.severity_min,
    level: row.level,
    notifyPersonId: row.notify_person_id,
    notifyRole: row.notify_role,
    channel: row.channel,
    delayMinutes: row.delay_minutes,
    repeatMinutes: row.repeat_minutes,
    repeatCap: row.repeat_cap,
    active: row.active,
  }),
  switchTo: (active) => ({ active }),
  uniqueField: 'trigger',
  taken: 'The ladder already has that rule',
  can: canSettingsSla,
  check: checkRule,
  store: ruleStore,
  prepare: ensureEscalationDefaults,
};

export const LADDER_RESOURCES: readonly Resource[] = [roster, rules];
