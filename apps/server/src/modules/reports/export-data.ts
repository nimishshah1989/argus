import { pmNextDue, pmReportSchema, type AnalyticsProfile } from '@uptimo/shared';
import {
  effectivePmPlan,
  plantDay,
  type EngineData,
  type ExportData,
  type ExportPmPlan,
  type ExportPmReport,
  type ExportSettings,
  UNLISTED,
} from '@uptimo/domain';
import type { PmExportReportRow } from '../tickets/index.js';

/**
 * The workbook's input, built from what the server already loads (ticket 45, packet 45d): the engine's plant rows,
 * the analytics profile and the tenant's name. The Settings sheet's lists are read off those rows — the segment,
 * category, cell, location and shift values the plant actually holds, then the configured lists' own codes — so a
 * live export needs no extra query. The AMC & Warranty and Legal Compliance sheets print the asset register's own
 * rows (51c); the platform's App Settings is still absent, so its sheet prints its header row today.
 */

/** The distinct values of `values`, in the order they first appear, skipping blanks. */
function unique(values: Iterable<string | null>): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const value of values) {
    if (value === null || value === '' || seen.has(value)) continue;
    seen.add(value);
    list.push(value);
  }
  return list;
}

/** A configured list's codes, then any value a row holds that the list does not name yet. */
function configuredThen(codes: readonly string[], values: Iterable<string | null>): string[] {
  return unique([...codes, ...values]);
}

const segmentsOf = (data: EngineData): string[] =>
  unique(data.machines.map((machine) => machine.segment));

const categoriesOf = (data: EngineData, segment?: string): string[] =>
  unique(
    data.machines
      .filter((machine) => segment === undefined || machine.segment === segment)
      .map((machine) => machine.category),
  );

/** The plant's Settings lists as the workbook's Settings sheet prints them. */
export function exportSettingsFor(data: EngineData): ExportSettings {
  const listCodes = (name: string): string[] =>
    (data.lists[name] ?? []).map((item) => item.code).filter((code) => code !== '');
  return {
    segments: segmentsOf(data),
    categories: categoriesOf(data),
    conventionalCategories: categoriesOf(data, 'Conventional'),
    processCategories: categoriesOf(data, 'Process'),
    utilityCategories: categoriesOf(data, 'Utility'),
    shifts: unique(data.reports.map((report) => report.shift)),
    locations: configuredThen(
      listCodes('location'),
      data.machines.map((machine) => machine.location),
    ),
    cells: configuredThen(
      listCodes('cell'),
      data.machines.map((machine) => machine.cell),
    ),
    breakdownCategories: configuredThen(
      listCodes('breakdown_category'),
      data.reports.map((report) => report.category),
    ),
    team: data.people.map((person) => ({
      name: person.displayName,
      type: person.team === 'vendor' ? 'Vendor' : 'Team',
    })),
  };
}

/** The platform's three spare-cost slots by report id: the stored row has one sum, the other two slots are blank. */
function spareCostsOf(data: EngineData): Readonly<Record<string, readonly (number | null)[]>> {
  const costs: Record<string, readonly (number | null)[]> = {};
  for (const report of data.reports) {
    const slots =
      report.spareCosts ??
      (report.spareCost === null || report.spareCost === undefined
        ? null
        : [report.spareCost, null, null]);
    if (slots !== null && slots.some((slot) => slot !== null)) costs[report.id] = slots;
  }
  return costs;
}

/**
 * The live PM Plan sheet's rows (ticket 50, R15): one per machine's effective plan, dated by its next due. This is
 * the product's 125 next dates, never the platform's 427 projected visits (49 R2's reduction); a plan with no
 * interval has no next due and prints no row. A category plan answers once per machine it covers, so every row
 * names the machine the sheet is about.
 */
function pmPlanRowsOf(data: EngineData): ExportPmPlan[] {
  const rows: ExportPmPlan[] = [];
  for (const machine of data.machines) {
    const plan = effectivePmPlan(data.pmPlans ?? [], machine);
    const date = plan === null ? null : pmNextDue(plan, data.timeZone);
    if (plan === null || date === null) continue;
    rows.push({
      id: plan.id,
      machineId: machine.code,
      date,
      source: 'plan',
      done: plan.lastDoneOn,
    });
  }
  return rows;
}

/** What a sheet prints for a machine or a person: the code and the coded name, never the id the rows carry. */
interface PrintedNames {
  machines: ReadonlyMap<string, string>;
  people: ReadonlyMap<string, string>;
}

/** One closed PM job as the PM Reports sheet prints it: the stored report's own numbers, its close and plan dates. */
function pmReportRowOf(
  row: PmExportReportRow,
  names: PrintedNames,
  timeZone: string,
): ExportPmReport | null {
  const parsed = pmReportSchema.safeParse(row.report);
  if (!parsed.success) return null;
  const { total, undone, readings, comments, doneBy } = parsed.data;
  return {
    id: row.ticketId,
    machineId: names.machines.get(row.machineId) ?? UNLISTED,
    date: plantDay(row.closedAt, timeZone),
    planDate: row.scheduledOn,
    total,
    undone,
    measurements: Object.fromEntries(
      Object.entries(readings).map(([key, value]) => [key, String(value)]),
    ),
    comments: comments === null ? [] : [comments],
    doneBy: doneBy === null ? null : (names.people.get(doneBy) ?? UNLISTED),
    data: parsed.data,
  };
}

/** The live PM Reports sheet's rows (50b, R15): one per closed PM job, printed from its own stored report. */
function pmReportRowsOf(rows: readonly PmExportReportRow[], data: EngineData): ExportPmReport[] {
  const names: PrintedNames = {
    machines: new Map(data.machines.map((machine) => [machine.id, machine.code])),
    people: new Map(data.people.map((person) => [person.id, person.displayName])),
  };
  return rows.flatMap((row) => {
    const report = pmReportRowOf(row, names, data.timeZone);
    return report === null ? [] : [report];
  });
}

/** Everything `workbookSheets` reads, from the load the routes already make. */
export function exportDataFor(input: {
  data: EngineData;
  profile: AnalyticsProfile;
  tenant: string;
  asOf: string;
  /** The closed PM jobs' stored reports (50b); absent prints the PM Reports sheet's header row only. */
  pmReports?: readonly PmExportReportRow[];
}): ExportData {
  return {
    tenant: input.tenant,
    asOf: input.asOf,
    profile: input.profile,
    data: input.data,
    settings: exportSettingsFor(input.data),
    spareCosts: spareCostsOf(input.data),
    pmPlan: pmPlanRowsOf(input.data),
    pmReports: pmReportRowsOf(input.pmReports ?? [], input.data),
  };
}
