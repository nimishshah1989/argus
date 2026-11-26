import { effectiveHours } from './rows.js';
import type { ReportRow } from './types.js';

export type DowntimeReport = Pick<ReportRow, 'downtimeMin' | 'maintCode' | 'recordedHours'>;

/**
 * A machine's average downtime per breakdown, in whole minutes: the engine's MTTR (breakdown hours over breakdowns,
 * `effectiveHours` per row, PM rows left out as `isPm` does) said in minutes. Null when it has no breakdown to
 * average, so a screen says so instead of printing a number.
 */
export function machineAverageDowntime(
  reports: readonly DowntimeReport[],
): { downtimeMin: number; breakdowns: number } | null {
  const breakdowns = reports.filter((report) => report.maintCode !== 'PM');
  if (breakdowns.length === 0) return null;
  const hours = breakdowns.reduce((sum, report) => sum + effectiveHours(report as ReportRow), 0);
  return {
    downtimeMin: Math.round((hours * 60) / breakdowns.length),
    breakdowns: breakdowns.length,
  };
}
