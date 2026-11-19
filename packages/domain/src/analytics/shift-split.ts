import type { AnalyticsProfile } from '@uptimo/shared';
import type { ShiftWindow } from '../business-hours.js';
import { formatInr } from './format.js';
import { isProduction } from './machine-facts.js';
import { isPm, sourcedReports } from './rows.js';
import { failureEvents, shiftKey, standardTotals, type KpiTotals } from './standard-kpis.js';
import { shiftCalendar, workingHoursPlant, workingMinutesPerDay } from './working-hours.js';
import type { Computer, EngineData, FigureValue } from './types.js';

/**
 * The shift split (ticket 48, R8-R9): the failure set grouped by the shift recorded on its report, each shift on its
 * own share of the plant's working hours. The day's 1,260 minutes split 629/631 (the 18:29-18:30 overlap belongs to
 * the later shift, DOMAIN section 5), so the shift rows add to the plant exactly; a code the Settings have no window
 * for keeps its row, prints its counts and hours, and dashes the measures that need a denominator. The plant's own
 * MTTR, MTBF and availability are recomputed from the summed totals, never added or averaged from the rows.
 */

const DASH = '—';

/** One shift's row: its counts, exact hours and the measures its own working hours support. */
export interface ShiftSplitRow {
  code: string;
  breakdowns: number;
  breakdownHours: number;
  pmHours: number;
  workingHours: number | null;
  mttr: number | null;
  mtbf: number | null;
  /** A fraction (0.9913), never points: the page prints it as a percentage. */
  availability: number | null;
}

/** A minute of the day as the Settings spell a window (`08:00`, `18:29`). */
const clock = (minute: number): string =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

/** The page's label for a code: its effective window (the overlap trimmed), `no window` where none is on. */
function shiftLabel(windows: readonly ShiftWindow[], code: string): string {
  const name = code === '' ? DASH : code;
  const window = windows.find((candidate) => candidate.code === code);
  return window === undefined
    ? `${name} (no window)`
    : `${name} (${clock(window.startMinute)}–${clock(window.endMinute)})`;
}

/** The failure rows at or before the run date, on the production fleet the comparison reads. */
function eventsAt(data: EngineData, asOf: string) {
  const production = new Set(data.machines.filter(isProduction).map((machine) => machine.id));
  return failureEvents(data).filter(
    (event) => event.report.date <= asOf && production.has(event.report.machineId),
  );
}

/** The closed PM rows the comparison counts, so the split's PM cells sum to its PM total. */
function pmRowsAt(data: EngineData, asOf: string) {
  const production = new Set(data.machines.filter(isProduction).map((machine) => machine.id));
  return sourcedReports(data).filter(
    (row) =>
      isPm(row) &&
      row.ticket.status === 'closed' &&
      row.report.date <= asOf &&
      production.has(row.report.machineId),
  );
}

interface ShiftParts {
  breakdowns: number;
  breakdownHours: number;
  pmHours: number;
}

/** The failure and PM rows grouped by the recorded shift, in the Settings' own window order. */
export function shiftSplit(
  data: EngineData,
  profile: AnalyticsProfile,
  asOf: string,
): ShiftSplitRow[] {
  const plant = workingHoursPlant(data, profile, asOf);
  const { byShift } = workingMinutesPerDay(data.shifts ?? []);
  const parts = new Map<string, ShiftParts>();
  const partOf = (code: string): ShiftParts => {
    const found = parts.get(code);
    if (found !== undefined) return found;
    const made = { breakdowns: 0, breakdownHours: 0, pmHours: 0 };
    parts.set(code, made);
    return made;
  };
  for (const event of eventsAt(data, asOf)) {
    const part = partOf(shiftKey(event.report));
    part.breakdowns += 1;
    part.breakdownHours += event.hours;
  }
  for (const row of pmRowsAt(data, asOf))
    partOf(shiftKey(row.report)).pmHours += Math.max(0, row.report.downtimeMin) / 60;

  const startOf = (code: string): number =>
    data.shifts?.find((shift) => shift.code === code)?.startMinute ?? Number.MAX_SAFE_INTEGER;
  return [...parts.entries()]
    .map(([code, part]): ShiftSplitRow => {
      // Each shift's working hours are its share of the plant's, because the day's minutes are the shares' sum.
      const share = byShift[code] ?? 0;
      const workingHours =
        plant.hours !== null && plant.minutesPerDay > 0 && share > 0
          ? plant.hours * (share / plant.minutesPerDay)
          : null;
      return {
        code,
        ...part,
        workingHours,
        mttr:
          workingHours !== null && part.breakdowns > 0
            ? part.breakdownHours / part.breakdowns
            : null,
        mtbf:
          workingHours !== null && part.breakdowns > 0
            ? (workingHours - part.breakdownHours) / part.breakdowns
            : null,
        availability:
          workingHours !== null && workingHours > 0
            ? 1 - (part.breakdownHours + part.pmHours) / workingHours
            : null,
      };
    })
    .sort(
      (left, right) =>
        startOf(left.code) - startOf(right.code) || left.code.localeCompare(right.code),
    );
}

const measure = (value: number | null, decimals: number): string =>
  value === null ? DASH : formatInr(value, decimals);
const share = (value: number | null): string => (value === null ? DASH : formatInr(value * 100, 2));

/** The page's one table: the shift rows then the plant total, the plant's three rates from its own totals. */
function shiftTable(
  windows: readonly ShiftWindow[],
  rows: readonly ShiftSplitRow[],
  plant: KpiTotals,
) {
  const cells = rows.map((row) => [
    shiftLabel(windows, row.code),
    formatInr(row.breakdowns, 0),
    formatInr(row.breakdownHours, 2),
    formatInr(row.pmHours, 2),
    measure(row.workingHours, 2),
    measure(row.mttr, 2),
    measure(row.mtbf, 1),
    share(row.availability),
  ]);
  const total = [
    'PLANT TOTAL',
    formatInr(plant.failures, 0),
    formatInr(plant.breakdownHours, 2),
    formatInr(plant.pmHours, 2),
    measure(plant.workingHours, 2),
    measure(plant.mttr, 2),
    measure(plant.mtbf, 1),
    share(plant.availability),
  ];
  return {
    title: 'Breakdowns, hours and MTTR by shift',
    header: [
      'Shift',
      'Breakdowns',
      'BD hours',
      'PM hours',
      'Working hours',
      'MTTR',
      'MTBF',
      'Availability',
    ],
    rows: [...cells, total],
    rowCount: cells.length + 1,
  };
}

/**
 * The shift-split figure: the three recorded shifts and the plant total. A plant with no failure has nothing to
 * split, so the figure is null rather than a fabricated zero; no active window still prints the counts and dashes
 * the hours, the same honest dash the comparison prints (R3). Every failure ticket is its drill.
 */
export const shiftKpisShiftSplitFigure: Computer = ({ data, asOf, profile }) => {
  const events = eventsAt(data, asOf);
  if (events.length === 0) return { value: null, drillIds: [] };
  const rows = shiftSplit(data, profile, asOf);
  const plant = standardTotals(data, profile, asOf);
  const calendar = shiftCalendar(data.shifts ?? [], data.timeZone);
  const noWindows = workingMinutesPerDay(data.shifts ?? []).total === 0;
  const value = {
    screen: 'shift-kpis',
    asOf,
    shifts: rows,
    pages: [
      {
        page: 'shift-kpis',
        title: 'The shift split',
        kpis: noWindows
          ? [
              {
                label: 'No shift windows in Settings',
                value: DASH,
                sub: 'counts and recorded hours still print',
              },
            ]
          : [],
        tables: [shiftTable(calendar.windows, rows, plant)],
        charts: [],
      },
    ],
  };
  return {
    value: value as unknown as FigureValue,
    drillIds: events.map((event) => event.ticket.id),
  };
};
