import type { RosterReply, RuleReply } from '@uptimo/shared/escalation-settings';
import type { AssetKind, AssetRegisterReply, ShiftReply } from '@uptimo/shared/plant-settings';
import type { PmPlanReply } from '@uptimo/shared/pm';

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

/** Null when no active plan has a due date. A plan due today is not overdue. */
export function pmTakeaway(plans: readonly PmPlanReply[], today: Day): PmTakeaway | null {
  void plans;
  void today;
  throw new Error('not implemented');
}

/** Null when no active row has a watch date. Ties keep the rows' order. */
export function registerTakeaway(
  rows: readonly AssetRegisterReply[],
  today: Day,
): RegisterTakeaway | null {
  void rows;
  void today;
  throw new Error('not implemented');
}

/** The L1 slots from `from` for `days` days with no active L1 entry; gaps by date, then shift order. */
export function rosterGaps(
  entries: readonly RosterReply[],
  shifts: readonly ShiftReply[],
  from: Day,
  days = 7,
): RosterGaps {
  void entries;
  void shifts;
  void from;
  void days;
  throw new Error('not implemented');
}

/** Active `ack_missed` rules (every one applies to an S1 ticket), one step per level at its earliest delay, by delay. */
export function ladderSteps(rules: readonly RuleReply[]): LadderStep[] {
  void rules;
  throw new Error('not implemented');
}
