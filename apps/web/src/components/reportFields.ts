import type {
  BreakdownCategory,
  BreakdownReportBody,
  Config,
  Person,
  Shift,
  Ticket,
} from '../api.js';
import type { FinishFigures } from './closeFinish.js';

/** One report is Done By x3 (the first is required) and Supported By x1, as v3's form (design lock, slice 2). */
export const DONE_SLOTS = 3;

export interface ReportValues {
  problem: string;
  observedBy: string;
  correctiveAction: string;
  doneBy: string[];
  supportedBy: string;
  downtimeMin: string;
  responseMin: string;
  repairMin: string;
  breakdownCategory: string;
  /** The one code a close carries (Q33): picked from the plant's `failure_code` list. */
  failureComponent: string;
  spareUsed: string;
  handoverName: string;
  date: string;
  shiftCode: string;
}

function minutesText(value: number | null | undefined): string {
  return value == null ? '' : String(value);
}

export function tenantToday(timeZone?: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(at);
}

function clockMinutes(time: string): number {
  const [hours = '0', minutes = '0'] = time.split(':');
  return Number(hours) * 60 + Number(minutes);
}

/** The shift whose window contains the tenant-local time now, if the plant has shifts. */
export function currentShiftCode(
  shifts: Shift[],
  timeZone?: string,
  at: Date = new Date(),
): string {
  if (shifts.length === 0) return '';
  const now = clockMinutes(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone,
    }).format(at),
  );
  const shift = shifts.find((item) => {
    const start = clockMinutes(item.starts_at);
    const end = clockMinutes(item.ends_at);
    return item.crosses_midnight ? now >= start || now < end : now >= start && now < end;
  });
  return shift?.code ?? '';
}

/** The form's first values: the ticket's own facts and the figures at the chosen finish (or the stored ones). */
export function initialReportValues(
  ticket: Ticket,
  config: Config,
  chosen?: FinishFigures,
  at: Date = new Date(),
): ReportValues {
  const stored = ticket.figures;
  const downtime = chosen ? chosen.downtimeMin : (stored?.downtimeMin ?? stored?.downAccMin);
  return {
    problem: ticket.problem,
    observedBy: '',
    correctiveAction: '',
    doneBy: [ticket.leadPersonId ?? '', '', ''],
    supportedBy: '',
    downtimeMin: minutesText(downtime),
    responseMin: minutesText(chosen ? chosen.responseMin : stored?.responseMin),
    repairMin: minutesText(chosen ? chosen.repairMin : stored?.repairMin),
    breakdownCategory: '',
    failureComponent: '',
    spareUsed: '',
    handoverName: '',
    date: tenantToday(config.timeZone, at),
    shiftCode: currentShiftCode(config.shifts, config.timeZone, at),
  };
}

function text(value: string): string | undefined {
  return value.trim() || undefined;
}

function people(ids: string[]): string[] | undefined {
  const picked = [...new Set(ids.filter(Boolean))];
  return picked.length > 0 ? picked : undefined;
}

function minutes(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : undefined;
}

/** The categories the server accepts; the plant's own list may only narrow or relabel them. */
const SERVER_CATEGORIES: readonly BreakdownCategory[] = ['E', 'M', 'E/M', 'PM'];

function category(value: string): BreakdownCategory | undefined {
  return SERVER_CATEGORIES.find((code) => code === value);
}

export function buildReportBody(values: ReportValues): BreakdownReportBody {
  return {
    problem: text(values.problem),
    observedBy: text(values.observedBy),
    correctiveAction: text(values.correctiveAction),
    doneByPersonIds: people(values.doneBy),
    supportedByPersonIds: people([values.supportedBy]),
    downtimeMin: minutes(values.downtimeMin),
    responseMin: minutes(values.responseMin),
    repairMin: minutes(values.repairMin),
    breakdownCategory: category(values.breakdownCategory),
    failureComponent: text(values.failureComponent),
    spareUsed: text(values.spareUsed),
    handoverName: text(values.handoverName),
    date: text(values.date),
    shiftCode: text(values.shiftCode),
  };
}

/** The report can be sent once the problem, the first Done By, the category and the code are set. */
export function reportReady(values: ReportValues): boolean {
  return Boolean(
    values.problem.trim() &&
    values.doneBy[0] &&
    category(values.breakdownCategory) &&
    values.failureComponent.trim(),
  );
}

export function listOptions(config: Config, list: string): { value: string; label: string }[] {
  return (config.lists[list] ?? [])
    .filter((item) => item.active !== false)
    .map((item) => ({ value: item.code, label: item.label }));
}

/**
 * The close's one code (Q33), from the plant's `failure_code` list and only the rows still switched on, so
 * a code switched off keeps its old reports and is never offered for a new close (R6). While the plant has
 * no failure-code rows at all — the deploy window before the settings screen or a coded close creates them —
 * the same box offers the plant's own maintenance codes, never a hardcoded list (R4's bridge).
 */
export function codeOptions(config: Config): { value: string; label: string }[] {
  const codes = config.lists.failure_code ?? [];
  return codes.length > 0 ? listOptions(config, 'failure_code') : listOptions(config, 'maint_code');
}

/** The plant's breakdown categories the server accepts, or the fixed four when the plant has no list. */
export function categoryOptions(config: Config): { value: string; label: string }[] {
  const planned = listOptions(config, 'breakdown_category').filter((o) => category(o.value));
  return planned.length > 0 ? planned : SERVER_CATEGORIES.map((c) => ({ value: c, label: c }));
}

export function shiftOptions(shifts: Shift[]): { value: string; label: string }[] {
  return shifts.map((shift) => ({ value: shift.code, label: shift.name }));
}

export function activePeople(list: Person[]): Person[] {
  return list.filter((person) => person.active !== false);
}
