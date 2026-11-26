import type { RosterReply, RuleReply } from '@uptimo/shared/escalation-settings';
import type { AssetKind, AssetRegisterReply, ShiftReply } from '@uptimo/shared/plant-settings';
import { addDays, type PmPlanReply } from '@uptimo/shared/pm';
import { pmPlanNextDue } from './pm-plans-spec.js';
import { watchOf } from './registers-spec.js';

/** Days are plant calendar days, "YYYY-MM-DD". */
type Day = string;

/** Active plans with a due date (`pmPlanNextDue`): how many are past due, the latest one, and the next one due. */
export type PmTakeaway = {
  total: number;
  overdue: number;
  worst: { planId: string; daysLate: number } | null;
  next: { planId: string; dueOn: Day } | null;
};

/** One register row by its watch date (`watchOf`); `days` from today, negative once past. */
export type RegisterWatch = {
  id: string;
  kind: AssetKind;
  machineId: string | null;
  on: Day;
  days: number;
};
export type RegisterTakeaway = { soonest: RegisterWatch; next: RegisterWatch | null };

/** One day × one active shift that needs a first call (L1). */
export type RosterSlot = { date: Day; shiftId: string };
export type RosterGaps = { gaps: RosterSlot[]; covered: number; slots: number };

/** One rung of the ladder an unanswered High (S1) ticket climbs. */
export type LadderStep = { level: RuleReply['level']; delayMinutes: number };

const daysBetween = (from: Day, to: Day): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** Null when no active plan has a due date. A plan due today is not overdue. */
export function pmTakeaway(plans: readonly PmPlanReply[], today: Day): PmTakeaway | null {
  const due = plans
    .filter((plan) => plan.active)
    .flatMap((plan) => {
      const dueOn = pmPlanNextDue(plan);
      return dueOn ? [{ planId: plan.id, dueOn, days: daysBetween(dueOn, today) }] : [];
    });
  if (due.length === 0) return null;
  const late = due.filter((d) => d.days > 0);
  const worst = late.reduce<(typeof late)[number] | null>(
    (a, d) => (a && a.days >= d.days ? a : d),
    null,
  );
  const next = due
    .filter((d) => d.days <= 0)
    .reduce<(typeof due)[number] | null>((a, d) => (a && a.dueOn <= d.dueOn ? a : d), null);
  return {
    total: due.length,
    overdue: late.length,
    worst: worst && { planId: worst.planId, daysLate: worst.days },
    next: next && { planId: next.planId, dueOn: next.dueOn },
  };
}

/** Null when no active row has a watch date. Ties keep the rows' order. */
export function registerTakeaway(
  rows: readonly AssetRegisterReply[],
  today: Day,
): RegisterTakeaway | null {
  const watches = rows
    .filter((row) => row.active)
    .flatMap((row): RegisterWatch[] => {
      const on = watchOf(row);
      return on
        ? [
            {
              id: row.id,
              kind: row.kind,
              machineId: row.machineId,
              on,
              days: daysBetween(today, on),
            },
          ]
        : [];
    })
    .sort((a, b) => a.days - b.days); // Array.sort is stable: ties keep the rows' order
  const [soonest, next] = watches;
  return soonest ? { soonest, next: next ?? null } : null;
}

/** The L1 slots from `from` for `days` days with no active L1 entry; gaps by date, then shift order. */
export function rosterGaps(
  entries: readonly RosterReply[],
  shifts: readonly ShiftReply[],
  from: Day,
  days = 7,
): RosterGaps {
  const covered = new Set(
    entries.filter((e) => e.active && e.level === 'L1').map((e) => `${e.date}|${e.shiftId}`),
  );
  const open = shifts.filter((shift) => shift.active);
  const gaps: RosterSlot[] = [];
  for (let i = 0; i < days; i += 1) {
    const date = addDays(from, i);
    for (const shift of open) {
      if (!covered.has(`${date}|${shift.id}`)) gaps.push({ date, shiftId: shift.id });
    }
  }
  const slots = open.length * days;
  return { gaps, covered: slots - gaps.length, slots };
}

/** Active `ack_missed` rules (every one applies to an S1 ticket), one step per level at its earliest delay, by delay. */
export function ladderSteps(rules: readonly RuleReply[]): LadderStep[] {
  const earliest = new Map<RuleReply['level'], number>();
  for (const rule of rules) {
    if (!rule.active || rule.trigger !== 'ack_missed') continue;
    earliest.set(rule.level, Math.min(earliest.get(rule.level) ?? Infinity, rule.delayMinutes));
  }
  return [...earliest]
    .map(([level, delayMinutes]) => ({ level, delayMinutes }))
    .sort((a, b) => a.delayMinutes - b.delayMinutes);
}
