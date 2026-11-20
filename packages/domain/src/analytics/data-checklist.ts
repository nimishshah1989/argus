import { machineAge } from './machine-facts.js';
import { dayNumber, dmy, dmyOfDay } from './plant-date.js';
import {
  effectiveHours,
  isHistory,
  isNoDowntime,
  isPm,
  sourcedReports,
  type SourcedReport,
} from './rows.js';
import type { Computer, MachineRow } from './types.js';

/** The platform's group order, which is also the order the checklist screen lists them in. */
const GROUPS = [
  'bd_date',
  'bd_mach',
  'bd_hrs',
  'bd_code',
  'bd_done',
  'bd_prob',
  'bd_shift',
  'bd_obs',
  'bd_em',
  'log_gap',
  'ww',
  'mc_age',
  'mc_dim',
  'mc_pw',
  'mc_cell',
  'mc_loc',
] as const;

type ChecklistItem = {
  group: string;
  key: string;
  plain: string;
};

/** The date as the platform writes it; an unreadable date keeps whatever the row holds. */
function dateText(date: string): string {
  if (dayNumber(date) !== null) return dmy(date);
  return date === '' ? 'No date' : date;
}

/** A NO-DT row is a breakdown with zero hours by design; every other row with zero hours is missing data. */
const missingHours = (row: SourcedReport): boolean =>
  !isNoDowntime(row) && !(effectiveHours(row.report) > 0);

/** PM has no Electrical / Mechanical type to record, so only a real breakdown can be missing it. */
const missingEmType = (row: SourcedReport): boolean =>
  !isPm(row) && (row.report.category ?? '').trim() === '';

/**
 * The breakdown groups (Guide section "Data Checklist"): every history entry missing a date, a known machine, hours,
 * a maintenance code, Done By, a problem, a shift, Observed By or the Electrical / Mechanical type.
 */
function breakdownItems(
  rows: readonly SourcedReport[],
  codes: ReadonlyMap<string, string>,
): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  for (const row of rows) {
    const report = row.report;
    const plain = `${dateText(report.date)} · ${codes.get(report.machineId) ?? (report.machineId === '' ? '?' : report.machineId)}`;
    const checks: ReadonlyArray<readonly [string, string, boolean]> = [
      ['bd_date', 'date missing or invalid', dayNumber(report.date) === null],
      ['bd_mach', `machine ID "${report.machineId}" not found`, !codes.has(report.machineId)],
      ['bd_hrs', 'downtime hours missing', missingHours(row)],
      ['bd_code', 'maintenance code missing', (report.maintCode ?? '').trim() === ''],
      ['bd_done', 'Done By missing', report.doneBy.length === 0],
      ['bd_prob', 'problem description missing', report.problem.trim() === ''],
      ['bd_shift', 'shift missing', report.shift.trim() === ''],
      ['bd_obs', 'Observed By missing', (report.observedBy ?? '').trim() === ''],
      ['bd_em', 'Electrical / Mechanical type missing', missingEmType(row)],
    ];
    for (const [group, what, missing] of checks) {
      if (missing) items.push({ group, key: `${group}|${report.id}`, plain: `${plain} — ${what}` });
    }
  }
  return items;
}

/** Runs of four or more days with no entry at all, plus a log that has not been updated for more than two days. */
function gapItems(rows: readonly SourcedReport[], asOf: string): ChecklistItem[] {
  const days = rows.flatMap((row) => {
    const day = dayNumber(row.report.date);
    return day === null ? [] : [day];
  });
  if (days.length === 0) return [];
  const first = Math.min(...days);
  const last = Math.max(...days);
  const have = new Set(days);
  const runs: Array<{ start: number; end: number; n: number }> = [];
  let run: { start: number; end: number; n: number } | null = null;
  for (let day = first; day <= last; day += 1) {
    if (!have.has(day)) {
      run ??= { start: day, end: day, n: 0 };
      run.end = day;
      run.n += 1;
    } else if (run !== null) {
      if (run.n >= 4) runs.push(run);
      run = null;
    }
  }
  if (run !== null && run.n >= 4) runs.push(run);
  runs.sort((a, b) => a.start - b.start);
  const items = runs.map((gap) => ({
    group: 'log_gap',
    key: `log_gap|${dmyOfDay(gap.start)}|${dmyOfDay(gap.end)}`,
    plain: `${dmyOfDay(gap.start)} to ${dmyOfDay(gap.end)} — ${gap.n} days with no entries`,
  }));
  const asOfDay = dayNumber(asOf);
  if (asOfDay !== null && asOfDay - last > 2) {
    items.push({
      group: 'log_gap',
      key: `log_gap|latest|${dmyOfDay(last)}`,
      plain: `${dmyOfDay(last + 1)} to ${dmyOfDay(asOfDay)} — log not updated since ${dmyOfDay(last)}`,
    });
  }
  return items;
}

/** Breakdowns over the Why-Why threshold that have no root-cause analysis, newest first. */
function whyWhyItems(
  rows: readonly SourcedReport[],
  threshold: number,
  codes: ReadonlyMap<string, string>,
): ChecklistItem[] {
  return rows
    .filter((row) => !isPm(row) && effectiveHours(row.report) > threshold)
    .sort((a, b) => (dayNumber(b.report.date) ?? 0) - (dayNumber(a.report.date) ?? 0))
    .map((row) => ({
      group: 'ww',
      key: `ww|${row.report.id}`,
      plain: `${dmy(row.report.date)} · ${codes.get(row.report.machineId) ?? row.report.machineId} — ${effectiveHours(
        row.report,
      ).toFixed(1)} hrs, Why-Why not done`,
    }));
}

/** The five machine sheets, in the platform's order, with the name each item key carries. */
const SHEETS: ReadonlyArray<{ segment: string; key: string }> = [
  { segment: 'CNC', key: 'machines' },
  { segment: 'Conventional', key: 'convMachines' },
  { segment: 'Process', key: 'procMachines' },
  { segment: 'Utility', key: 'utilMachines' },
  { segment: 'DG', key: 'dgMachines' },
];

/** The sheets that record a cell; DG sets and utilities sit in a location, not a cell. */
const CELL_SHEETS = new Set(['machines', 'convMachines', 'procMachines']);

/** Footprint needs both dimensions; DG sets are not packed into the floor plan. */
function missingFootprint(machine: MachineRow, sheetKey: string): boolean {
  if (sheetKey === 'dgMachines') return false;
  return !(Number(machine.metadata.length) > 0 && Number(machine.metadata.width) > 0);
}

/** Power needs a number; DG sets record capacity instead, and a stabilizer or UPS records no load. */
function missingPower(machine: MachineRow, sheetKey: string): boolean {
  if (sheetKey === 'utilMachines' && /stabili[sz]er|\bups\b/i.test(machine.category ?? '')) {
    return false;
  }
  const power = sheetKey === 'dgMachines' ? machine.capacityKva : machine.powerKw;
  return power === null || power === undefined || String(power).trim() === '';
}

/** What one machine record is missing, in the platform's group order. */
function machineProblems(
  machine: MachineRow,
  sheetKey: string,
  asOf: string,
): ReadonlyArray<readonly [string, string]> {
  const problems: Array<readonly [string, string]> = [];
  const flag = (group: string, what: string, missing: boolean): void => {
    if (missing) problems.push([group, what]);
  };
  flag('mc_age', 'purchase date or year missing', machineAge(machine, asOf) === null);
  flag('mc_dim', 'length and width missing', missingFootprint(machine, sheetKey));
  flag(
    'mc_pw',
    sheetKey === 'dgMachines' ? 'capacity (kVA) missing' : 'power missing',
    missingPower(machine, sheetKey),
  );
  flag('mc_cell', 'cell missing', CELL_SHEETS.has(sheetKey) && (machine.cell ?? '').trim() === '');
  flag('mc_loc', 'location missing', (machine.location ?? '').trim() === '');
  return problems;
}

/** Machine records missing what the plant's analyses need: age, dimensions, power, cell or location. */
function machineItems(machines: readonly MachineRow[], asOf: string): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  for (const sheet of SHEETS) {
    for (const machine of machines.filter((row) => row.segment === sheet.segment)) {
      for (const [group, what] of machineProblems(machine, sheet.key, asOf)) {
        items.push({
          group,
          key: `${group}|${sheet.key}|${machine.id}`,
          plain: `${machine.code} — ${what}`,
        });
      }
    }
  }
  return items;
}

/**
 * The Data Checklist (Guide section "Data Checklist"): what is missing in the breakdown log and the machine records,
 * grouped as the platform grouped it. Its value carries every open item; its drill names the tickets behind the
 * breakdown items, because the machine items have no ticket to open (the screen renders the items themselves).
 */
export const dataChecklist: Computer = ({ data, asOf, profile }) => {
  const history = sourcedReports(data).filter(isHistory);
  const codes = new Map(data.machines.map((machine) => [machine.id, machine.code]));
  const items = [
    ...breakdownItems(history, codes),
    ...gapItems(history, asOf),
    ...whyWhyItems(history, profile.whyWhyThresholdHours, codes),
    ...machineItems(data.machines, asOf),
  ];
  const order = new Map<string, number>(GROUPS.map((group, index) => [group, index]));
  items.sort((a, b) => (order.get(a.group) ?? 0) - (order.get(b.group) ?? 0));
  const counts: Record<string, number> = {};
  for (const item of items) counts[item.group] = (counts[item.group] ?? 0) + 1;
  const ticketByReport = new Map(history.map((row) => [row.report.id, row.ticket.id]));
  const drillIds = items.flatMap((item) => {
    if (item.group !== 'ww' && !item.group.startsWith('bd_')) return [];
    const ticket = ticketByReport.get(item.key.slice(item.key.indexOf('|') + 1));
    return ticket === undefined ? [] : [ticket];
  });
  return { value: { counts, items }, drillIds };
};
