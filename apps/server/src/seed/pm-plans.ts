import { PM_MEASUREMENT_LABELS } from '@uptimo/shared/pm';

export { PM_MEASUREMENT_LABELS };

/**
 * The workbook's PM Plan is a list of projected visits: 427 dated rows for 125 machines (ticket 49a, R2). A
 * `pm_plan` row is a machine's recurring plan, so this mapper reduces the visits to one plan per machine and
 * keeps the machine's cadence and next date through the plan's clock anchor. Pure: the seed reads the rows,
 * this file decides the plan, and the plant repo writes it.
 */

export interface PmPlanVisit {
  id?: string;
  machineId: string;
  date: string;
  source: string;
  done?: string;
}

export interface PmReport {
  machineId: string;
  total: number;
  undone?: number[];
  meas: Record<string, string>;
}

export interface PmWorkbook {
  pmPlan: PmPlanVisit[];
  pmReports: PmReport[];
  settings: {
    pmFreq?: number;
    /** A machine's own frequency, when the plant overrides the default (`f` and, for custom, `d`). */
    pmMach?: Record<string, { f: string; d?: number }>;
  };
}

export type MappedChecklistItem =
  | { id: string; kind: 'tick'; point: number }
  | {
      id: string;
      kind: 'reading';
      point: number;
      metric: string;
      label: string;
      unit: 'mm';
    };

export interface MappedPmPlan {
  /** The machine code; the plant seed resolves it to the machine's id. */
  machineId: string;
  title: string;
  intervalDays: number;
  lastDoneOn: string | null;
  /** The row's clock anchor: `lastDoneOn` else the next date less one interval; may be in the future. */
  anchorOn: string;
  checklist: MappedChecklistItem[];
}

export interface MappedPmReport {
  machineId: string;
  total: number;
  tick: number;
  readings: number;
}

export interface PmPlanMapping {
  plans: MappedPmPlan[];
  /** The workbook's data rows, all of them visits. */
  sourceRows: number;
  /** Visits by the date's source (`plan`, `rule`, `manual`, `auto`); every date is a cadence anchor (R2). */
  visits: Record<string, number>;
  reports: MappedPmReport[];
}

const DAY = 86_400_000;
/** The workbook export's as-of date: every next date after it is the machine's next planned visit. */
export const PM_WORKBOOK_AS_OF = '2026-11-11';
const parse = (day: string): number => Date.parse(`${day}T00:00:00Z`);
const addDays = (day: string, n: number): string =>
  new Date(parse(day) + n * DAY).toISOString().slice(0, 10);

/** The platform's frequency choices as days; a month is 30.4 days, the platform's own average. */
const FREQUENCY_DAYS: Record<string, number> = {
  '2w': 3.5,
  '1w': 7,
  '2wk': 14,
  '1m': 30.4,
  '2m': 60.8,
  '3m': 91.2,
  '4m': 121.6,
  '6m': 182.4,
  '12m': 364.8,
};

/** `pmFreq` is PMs a year; a machine's `pmMach` overrides it (default, weeks, months or custom days). */
function intervalDays(settings: PmWorkbook['settings'], machineId: string): number {
  const own = settings.pmMach?.[machineId];
  if (own && own.f !== 'auto') {
    if (own.f === 'custom') return Math.max(1, Math.round(Number(own.d) || 30));
    const fixed = FREQUENCY_DAYS[own.f];
    if (fixed) return Math.max(1, Math.round(fixed));
  }
  const perYear = Number(settings.pmFreq) > 0 ? Number(settings.pmFreq) : 2;
  const stepMonths = Math.max(1, Math.round(12 / perYear));
  return Math.max(1, Math.round(stepMonths * 30.4));
}

/** The numbered checklist (R5): every point is a tick item; readings follow, keyed `<point>.<metric>`. */
function checklistOf(report: PmReport | undefined): MappedChecklistItem[] {
  if (!report) return [];
  const ticks: MappedChecklistItem[] = [];
  for (let point = 1; point <= report.total; point += 1)
    ticks.push({ id: String(point), kind: 'tick', point });
  const readings: MappedChecklistItem[] = Object.keys(report.meas).flatMap((key) => {
    const [point, metric] = key.split('.');
    const number = Number(point);
    if (!Number.isInteger(number) || number <= 0 || !metric) return [];
    return [
      {
        id: key,
        kind: 'reading' as const,
        point: number,
        metric,
        label: PM_MEASUREMENT_LABELS[metric] ?? metric,
        unit: 'mm' as const,
      },
    ];
  });
  readings.sort((a, b) =>
    a.kind === 'reading' && b.kind === 'reading'
      ? a.point - b.point || a.metric.localeCompare(b.metric)
      : 0,
  );
  return [...ticks, ...readings];
}

/**
 * The next planned date after `asOf`; a machine whose visits are all past falls back to one interval after its
 * last done (or its last dated visit), so an old workbook still yields a live plan.
 */
function nextDate(rows: PmPlanVisit[], asOf: string, lastDoneOn: string | null, interval: number) {
  const dates = rows.map((row) => row.date).sort();
  const next = dates.find((date) => date > asOf);
  if (next) return next;
  const last = lastDoneOn ?? dates.at(-1);
  return last ? addDays(last, interval) : asOf;
}

export function mapPmPlans(workbook: PmWorkbook, options: { asOf: string }): PmPlanMapping {
  const { asOf } = options;
  const byMachine = new Map<string, PmPlanVisit[]>();
  const visits: Record<string, number> = {};
  for (const row of workbook.pmPlan) {
    byMachine.set(row.machineId, [...(byMachine.get(row.machineId) ?? []), row]);
    visits[row.source] = (visits[row.source] ?? 0) + 1;
  }
  const reports = new Map(workbook.pmReports.map((report) => [report.machineId, report]));
  const plans = [...byMachine.entries()]
    .map(([machineId, rows]): MappedPmPlan => {
      const interval = intervalDays(workbook.settings, machineId);
      const lastDoneOn =
        rows
          .flatMap((row) => (row.done ? [row.done] : []))
          .sort()
          .at(-1) ?? null;
      const anchorOn = lastDoneOn ?? addDays(nextDate(rows, asOf, lastDoneOn, interval), -interval);
      return {
        machineId,
        title: `${machineId} preventive maintenance`,
        intervalDays: interval,
        lastDoneOn,
        anchorOn,
        checklist: checklistOf(reports.get(machineId)),
      };
    })
    .sort((a, b) => a.machineId.localeCompare(b.machineId));
  return {
    plans,
    sourceRows: workbook.pmPlan.length,
    visits,
    reports: workbook.pmReports.map((report) => ({
      machineId: report.machineId,
      total: report.total,
      tick: report.total,
      readings: Object.keys(report.meas).length,
    })),
  };
}
