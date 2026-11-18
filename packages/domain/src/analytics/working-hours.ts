import type { AnalyticsProfile } from '@uptimo/shared';
import { availableHours, availabilityWindow } from './availability.js';
import type { BusinessCalendar, ShiftWindow } from '../business-hours.js';
import type { DateWindow } from './hours.js';
import { isProduction } from './machine-facts.js';
import type { EngineData, MachineRow, ShiftRow } from './types.js';

/**
 * The working-hours basis (ticket 48, R1-R2): the plant's own shift windows instead of the workbook's 20-hour
 * constant. The day is the union of the *active* windows on the 0-1440 circle, and where two windows overlap the
 * minute belongs to the later-starting one (DOMAIN section 5), so Cosmos's 08:00-18:30 and 18:29-05:00 are 629 and
 * 631 minutes: 21.00 hours a day, not 20. Nothing here reads the clock or the machine's zone.
 */

const DAY_MINUTES = 1_440;

/** How many minutes one window covers before any overlap is trimmed. */
function durationOf(window: ShiftWindow): number {
  return window.crossesMidnight
    ? DAY_MINUTES - window.startMinute + window.endMinute
    : window.endMinute - window.startMinute;
}

const windowOf = (shift: ShiftRow): ShiftWindow => ({
  code: shift.code,
  startMinute: shift.startMinute,
  endMinute: shift.endMinute,
  crossesMidnight: shift.crossesMidnight,
});

/**
 * The active windows, each trimmed where a later-starting window begins inside it: the overlap belongs to the later
 * shift, so the two windows never claim the same minute twice. A switched-off row is no working time at all.
 */
function effectiveWindows(shifts: readonly ShiftRow[]): ShiftWindow[] {
  const active = shifts.filter((shift) => shift.active).map(windowOf);
  return active.map((window) => {
    const length = durationOf(window);
    let end = window.endMinute;
    let nearest = length;
    for (const other of active) {
      if (other === window) continue;
      const offset = (other.startMinute - window.startMinute + DAY_MINUTES) % DAY_MINUTES;
      if (offset > 0 && offset < nearest) {
        nearest = offset;
        end = other.startMinute;
      }
    }
    return end === window.endMinute
      ? window
      : { ...window, endMinute: end, crossesMidnight: end < window.startMinute };
  });
}

/**
 * The plant's shift calendar for the SLA clocks and the backlog age: the active windows, the overlap to the later
 * shift. A plant with no active window gets an empty calendar, never a fabricated one.
 */
export function shiftCalendar(shifts: readonly ShiftRow[], timeZone: string): BusinessCalendar {
  return { timeZone, windows: effectiveWindows(shifts) };
}

/**
 * One day's working minutes and how many of them each shift owns. The rows add to `total` because the overlap was
 * given to the later shift, so the plant's shift split never sums to 1,261 minutes a day (R9).
 */
export function workingMinutesPerDay(shifts: readonly ShiftRow[]): {
  total: number;
  byShift: Record<string, number>;
} {
  const byShift: Record<string, number> = {};
  let total = 0;
  for (const window of effectiveWindows(shifts)) {
    const minutes = durationOf(window);
    byShift[window.code] = (byShift[window.code] ?? 0) + minutes;
    total += minutes;
  }
  return { total, byShift };
}

/** One machine's working hours in a window: the annual hours spread month by month from its purchase date. */
export function workingHoursFor(
  machine: MachineRow,
  shifts: readonly ShiftRow[],
  workDaysPerYear: number,
  window: DateWindow,
): number {
  const { total } = workingMinutesPerDay(shifts);
  if (total <= 0) return 0;
  const annualHours = (total / 60) * workDaysPerYear;
  return availableHours(machine, annualHours, window.from, window.to);
}

/** What the standard family needs from the plant: its window, its basis and its production fleet. */
export interface PlantWorkingHours {
  window: DateWindow;
  minutesPerDay: number;
  annualHours: number;
  /** Null when the plant has no active shift window: there is no denominator to print (R3). */
  hours: number | null;
  machines: MachineRow[];
}

/**
 * The production fleet's working hours in the days-so-far window: the same window and the same machines the legacy
 * column reads, with the plant's own shift windows as the denominator instead of `prodHrsPerDay`.
 */
export function workingHoursPlant(
  data: EngineData,
  profile: AnalyticsProfile,
  asOf: string,
): PlantWorkingHours {
  const { total } = workingMinutesPerDay(data.shifts ?? []);
  const window = availabilityWindow(asOf, asOf);
  const machines = data.machines.filter(isProduction);
  const annualHours = (total / 60) * profile.workDaysPerYear;
  const hours =
    total === 0
      ? null
      : machines.reduce(
          (sum, machine) => sum + availableHours(machine, annualHours, window.from, window.to),
          0,
        );
  return { window, minutesPerDay: total, annualHours, hours, machines };
}
