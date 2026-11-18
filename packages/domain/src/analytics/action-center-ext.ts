import { actionCenterKey } from './action-center-model.js';
import type { ActionCenterRecord, ActionContext } from './action-center-model.js';
import { dayNumber } from './plant-date.js';
import type { AmcLine, LegalLine } from './types.js';

/**
 * The Action Center's external reminders (ticket 44, packet 44a): an AMC or extended warranty ending soon, and a
 * legal test or calibration falling due. Both lines live in the plant's settings; M4b's register fills them, so a
 * plant with no dates raises nothing. The platform's own date arithmetic is here: a 12-month AMC from 1 January
 * ends on 31 December, and a test on 5 March is due again on 5 March.
 */

const DAY_MS = 86_400_000;

/** A plant date's whole UTC day number, or null when the text is not a date. */
const dayOf = (date: string | null): number | null =>
  date === null ? null : dayNumber(date.slice(0, 10));

/** A whole UTC day number as the plant's ISO date, the key's own form. */
const isoOf = (day: number): string => new Date(day * DAY_MS).toISOString().slice(0, 10);

/** The day number `months` calendar months later, the day clamped to the target month's last day. */
function addMonths(day: number, months: number): number {
  const start = new Date(day * DAY_MS);
  const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const target = Math.min(start.getUTCDate(), lastDay);
  return Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), target) / DAY_MS;
}

/** The contract's last day: a 12-month line from 1 Jan ends 31 Dec. */
export const amcEndDay = (startDay: number, months: number): number =>
  addMonths(startDay, months) - 1;

/** The next due day of a test valid for `months`. */
export const legalDueDay = (lastDay: number, months: number): number => addMonths(lastDay, months);

/** The Settings reminder window: 15 days when unset or unreadable, never negative. */
function remindDays(value: number | undefined): number {
  const days = Number(value);
  return value === undefined || !Number.isFinite(days) ? 15 : Math.max(0, Math.round(days));
}

const plural = (days: number): string => (days === 1 ? '' : 's');

/** The platform's wording when an AMC's end is `days` from the run date. */
function amcWhen(days: number): string {
  if (days < 0) return 'expired ' + -days + ' day' + plural(-days) + ' ago';
  if (days === 0) return 'ends today';
  return 'ends in ' + days + ' day' + plural(days);
}

/** The platform's wording when a legal test's due date is `days` from the run date. */
function legalWhen(days: number): string {
  if (days < 0) return 'overdue by ' + -days + ' day' + plural(-days);
  if (days === 0) return 'due today';
  return 'due in ' + days + ' day' + plural(days);
}

/** One line's end day, when it has both a start date and a positive tenure. */
function amcLineEnd(line: AmcLine): number | null {
  const start = dayOf(line.start);
  return start === null || !(line.months > 0) ? null : amcEndDay(start, line.months);
}

/** One line's due day, when it has both a last test and a positive validity. */
function legalLineDue(line: LegalLine): number | null {
  const last = dayOf(line.last);
  return last === null || !(line.months > 0) ? null : legalDueDay(last, line.months);
}

/**
 * The AMC reminders: a line of an existing machine (any segment) whose end is inside the reminder window, not
 * flagged "not renewing" and not cleared by a later line of the same machine and type.
 */
export function amcNudges(ctx: ActionContext): ActionCenterRecord[] {
  const lines = (ctx.data.amc ?? []).filter((line) => ctx.machines.has(line.machineId));
  const remind = remindDays(ctx.data.settings?.amcRemindDays);
  const out: ActionCenterRecord[] = [];
  for (const line of lines) {
    if (line.noRenew) continue;
    const end = amcLineEnd(line);
    if (end === null) continue;
    const days = end - ctx.asOfDay;
    if (days > remind) continue;
    const renewed = lines.some((other) => {
      const otherEnd = amcLineEnd(other);
      return (
        other !== line &&
        other.machineId === line.machineId &&
        other.type === line.type &&
        otherEnd !== null &&
        otherEnd > end
      );
    });
    if (renewed) continue;
    const type = line.type === null || line.type === '' ? 'AMC' : line.type;
    out.push({
      key: actionCenterKey.amc(line.id, isoOf(end)),
      rule: 'amc',
      sev: days <= 7 ? 'high' : 'med',
      title: line.machineId + ': ' + type + ' ' + amcWhen(days),
      machines: [line.machineId],
      entries: 0,
      ev: null,
      noRisk: true,
    });
  }
  return out;
}

/**
 * The legal reminders: a line of an existing machine whose next due date is inside the reminder window and not
 * cleared by a later test of the same machine and test type.
 */
export function legalNudges(ctx: ActionContext): ActionCenterRecord[] {
  const lines = (ctx.data.legal ?? []).filter((line) => ctx.machines.has(line.machineId));
  const remind = remindDays(ctx.data.settings?.legalRemindDays);
  const out: ActionCenterRecord[] = [];
  for (const line of lines) {
    const due = legalLineDue(line);
    if (due === null) continue;
    const days = due - ctx.asOfDay;
    if (days > remind) continue;
    const tested = lines.some((other) => {
      const otherLast = dayOf(other.last);
      const last = dayOf(line.last);
      return (
        other !== line &&
        other.machineId === line.machineId &&
        other.tid === line.tid &&
        otherLast !== null &&
        last !== null &&
        otherLast > last
      );
    });
    if (tested) continue;
    const name = line.name === '' ? 'Legal compliance' : line.name;
    const form = line.form === null || line.form === '' ? '' : ' (Form ' + line.form + ')';
    out.push({
      key: actionCenterKey.legal(line.id, isoOf(due)),
      rule: 'legal',
      sev: days <= 7 ? 'high' : 'med',
      title: line.machineId + ': ' + name + form + ' ' + legalWhen(days),
      machines: [line.machineId],
      entries: 0,
      ev: null,
      noRisk: true,
    });
  }
  return out;
}
