import { machineDayNumber } from './machine-facts.js';
import { dayNumber } from './plant-date.js';
import { problemGroupOf } from './problem-groups.js';
import { effectiveHours, isHistory, isPm, sourcedReports } from './rows.js';
import type { Computer } from './types.js';

const round = (value: number, decimals: 0 | 1 | 2): number =>
  Math.round(value * 10 ** decimals) / 10 ** decimals;

/**
 * Breakdown-free machines (Guide, "Breakdown-free machines"): CNC production machines whose last breakdown was 30
 * or more days before the as-of date (or that have none), out of the production machines in service that day.
 * A machine joins the fleet on its purchase date; PM does not count as a breakdown, NO DT does.
 */
export const breakdownFree: Computer = ({ data, asOf }) => {
  const asOfDay = dayNumber(asOf);
  if (asOfDay === null) return { value: { runningClean: 0, inService: 0 }, drillIds: [] };
  const excluded = new Set(data.settings?.excludedMachineIds ?? []);
  const machines = data.machines.filter(
    (machine) => machine.segment === 'CNC' && !excluded.has(machine.id),
  );
  const inService = machines.filter((machine) => {
    const joined = machineDayNumber(machine);
    return joined === null || joined <= asOfDay;
  });
  const lastBreakdown = new Map<string, number>();
  for (const row of sourcedReports(data)) {
    if (!isHistory(row) || isPm(row)) continue;
    const day = dayNumber(row.report.date);
    if (day === null) continue;
    const seen = lastBreakdown.get(row.report.machineId);
    if (seen === undefined || day > seen) lastBreakdown.set(row.report.machineId, day);
  }
  const clean = inService.filter((machine) => {
    const last = lastBreakdown.get(machine.id);
    return last === undefined || asOfDay - last >= 30;
  });
  return {
    value: { runningClean: clean.length, inService: inService.length },
    drillIds: clean.map((machine) => machine.id),
  };
};

interface ProblemTotal {
  problem: string;
  hours: number;
  breakdowns: number;
  tickets: string[];
}

/**
 * Problems costing the most downtime (Guide, "Problems costing the most downtime"): breakdown rows grouped by the
 * platform's problem groups, ranked by downtime hours, the top three with their share and breakdown count. A manual
 * group fix in the plant's settings wins over the text, as it did on the platform.
 */
export const costliestProblems: Computer = ({ data }) => {
  const excluded = new Set(data.settings?.excludedMachineIds ?? []);
  const cnc = new Set(
    data.machines.filter((machine) => machine.segment === 'CNC').map((machine) => machine.id),
  );
  const fixes = data.settings?.problemFixes ?? {};
  const groups = new Map<string, ProblemTotal>();
  for (const row of sourcedReports(data)) {
    if (!isHistory(row) || isPm(row)) continue;
    if (!cnc.has(row.report.machineId) || excluded.has(row.report.machineId)) continue;
    const name = problemGroupOf(row.report, fixes);
    const total = groups.get(name) ?? {
      problem: name,
      hours: 0,
      breakdowns: 0,
      tickets: [],
    };
    total.hours += effectiveHours(row.report);
    total.breakdowns += 1;
    total.tickets.push(row.ticket.id);
    groups.set(name, total);
  }
  const all = [...groups.values()];
  const downtime = all.reduce((sum, group) => sum + group.hours, 0);
  const ranked = all.sort((a, b) => b.hours - a.hours).slice(0, 3);
  const rows = ranked.map((group) => ({
    problem: group.problem,
    hours: round(group.hours, 0),
    share: downtime === 0 ? 0 : round((group.hours / downtime) * 100, 2),
    breakdowns: group.breakdowns,
  }));
  return {
    value: { rows, totalHours: round(downtime, 1) },
    drillIds: ranked.flatMap((group) => group.tickets),
  };
};
