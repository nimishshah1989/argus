import { formatInr, formatPercent } from './format.js';
import { isProduction } from './machine-facts.js';
import { effectiveHours, isPm, sourcedReports } from './rows.js';
import type { Computer, EngineData, FigureValue, MachineRow, PersonRow } from './types.js';

/**
 * A4, manpower efficiency (ticket 41, packet 41a): the platform's own page, whole — the three KPIs, the five tables
 * and the chart. The team is the Settings list in its own order (R6); the breakdowns are production data and never
 * PM; hours are the effective recorded hours. The table is sorted by done count, while the matrices keep the team
 * order, so the settings decide the rows and the sort only decides the one table.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DASH = '—';
/** The key prints a 12-character label whole ("WaterJet CNC") and shortens anything longer to 11 characters + "…". */
const LABEL_WIDTH = 11;
const LABEL_LIMIT = LABEL_WIDTH + 1;

interface Member {
  person: PersonRow;
  type: 'Team' | 'Vendor';
  doneCount: number;
  doneHours: number;
  supportedCount: number;
  supportedHours: number;
  /** The specialization counts, in the category columns' order. */
  spec: number[];
  bdCounts: number[];
  bdHours: number[];
  pmCounts: number[];
  pmHours: number[];
}

interface A4Context {
  members: Member[];
  categories: string[];
  totalBD: number;
  totalH: number;
  drillIds: string[];
}

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

/** The Settings team list, in its own order, read against the people rows (R6). */
function teamPeople(data: EngineData): PersonRow[] {
  const byCode = new Map(data.people.map((person) => [person.code, person]));
  const codes = data.settings?.teamCodes;
  if (codes !== undefined) {
    return codes.flatMap((code) => {
      const person = byCode.get(code);
      return person ? [person] : [];
    });
  }
  return data.people.filter((person) => person.team === 'maintenance' || person.team === 'vendor');
}

/**
 * The specialization's category columns: the plant's Settings category list in its own order when present, with
 * Robot dropped case-insensitively (a configured category with no machines prints an all-dash column); otherwise
 * the production fleet's categories in fleet order.
 */
function categoryList(data: EngineData, machines: readonly MachineRow[]): string[] {
  const configured = data.settings?.categories;
  const source = configured ?? machines.map((machine) => machine.category ?? '');
  const seen = new Set<string>();
  for (const value of source) {
    const category = value.trim();
    if (category === '') continue;
    if (category.toLowerCase() === 'robot' || seen.has(category)) continue;
    seen.add(category);
  }
  return [...seen];
}

/** The team members a report's names resolve to, deduplicated, in the order the report named them. */
function memberIndexes(codes: readonly string[], index: ReadonlyMap<string, number>): number[] {
  const found: number[] = [];
  for (const code of new Set(codes)) {
    const position = index.get(code);
    if (position !== undefined) found.push(position);
  }
  return found;
}

function newMember(person: PersonRow, categoryCount: number): Member {
  return {
    person,
    type: person.team === 'vendor' ? 'Vendor' : 'Team',
    doneCount: 0,
    doneHours: 0,
    supportedCount: 0,
    supportedHours: 0,
    spec: Array.from({ length: categoryCount }, () => 0),
    bdCounts: Array.from({ length: MONTHS.length }, () => 0),
    bdHours: Array.from({ length: MONTHS.length }, () => 0),
    pmCounts: Array.from({ length: MONTHS.length }, () => 0),
    pmHours: Array.from({ length: MONTHS.length }, () => 0),
  };
}

/** One pass over the sourced reports: production rows count as breakdowns unless PM; PM is its own year's matrix. */
function buildContext(data: EngineData, asOf: string): A4Context {
  const people = teamPeople(data);
  const production = data.machines.filter(isProduction);
  const categories = categoryList(data, production);
  const categoryIndex = new Map(categories.map((category, position) => [category, position]));
  const machineCategory = new Map(
    production.map((machine) => [machine.id, machine.category?.trim() ?? null]),
  );
  const index = new Map(people.map((person, position) => [person.code, position]));
  const members = people.map((person) => newMember(person, categories.length));
  const year = asOf.slice(0, 4);
  let totalBD = 0;
  let totalH = 0;
  const drillIds: string[] = [];
  for (const row of sourcedReports(data)) {
    const category = machineCategory.get(row.report.machineId);
    if (category === undefined) continue;
    const hours = effectiveHours(row.report);
    const month = Number(row.report.date.slice(5, 7)) - 1;
    if (isPm(row)) {
      if (row.report.date.slice(0, 4) !== year) continue;
      for (const position of memberIndexes(row.report.doneBy, index)) {
        const member = members[position]!;
        member.pmCounts[month]! += 1;
        member.pmHours[month]! += hours;
      }
      continue;
    }
    totalBD += 1;
    totalH += hours;
    drillIds.push(row.ticket.id);
    // The two BD month matrices read the year selector, as the platform's filterBD does; the table and the
    // specialization read the whole log (the key has one year, so both rules print the same page).
    const inYear = row.report.date.slice(0, 4) === year;
    for (const position of memberIndexes(row.report.doneBy, index)) {
      const member = members[position]!;
      member.doneCount += 1;
      member.doneHours += hours;
      if (inYear) {
        member.bdCounts[month]! += 1;
        member.bdHours[month]! += hours;
      }
      const column = category === null ? undefined : categoryIndex.get(category);
      if (column !== undefined) member.spec[column]! += 1;
    }
    for (const position of memberIndexes(row.report.supportedBy, index)) {
      const member = members[position]!;
      member.supportedCount += 1;
      member.supportedHours += hours;
    }
  }
  return { members, categories, totalBD, totalH, drillIds };
}

function kpis(ctx: A4Context) {
  return [
    { label: 'Total Breakdowns', value: String(ctx.totalBD), sub: 'PM excluded' },
    { label: 'Total BD Hours', value: formatInr(ctx.totalH, 1), sub: 'across all team' },
    { label: 'Team Members Tracked', value: String(ctx.members.length), sub: 'incl. vendors' },
  ];
}

function manpowerTable(members: readonly Member[], totalBD: number) {
  return {
    title: 'Manpower Table',
    header: [
      'Name',
      'Type',
      '# BD (Done By)',
      'BD Hours (Done)',
      'Avg MTTR',
      '# BD (Supported)',
      'Hours (Supported)',
      'Total Involvement',
      '% of Total',
    ],
    rows: members.map((member) => [
      member.person.displayName,
      member.type,
      String(member.doneCount),
      formatInr(member.doneHours, 2),
      formatInr(member.doneCount > 0 ? member.doneHours / member.doneCount : 0, 2),
      String(member.supportedCount),
      formatInr(member.supportedHours, 2),
      String(member.doneCount + member.supportedCount),
      formatPercent(member.doneCount / totalBD),
    ]),
    rowCount: members.length,
  };
}

function pmTable(printRows: readonly Member[], team: readonly Member[]) {
  const rows: string[][] = [];
  for (const member of printRows) {
    rows.push([
      member.person.displayName,
      ...member.pmCounts.map((count) => (count ? String(count) : DASH)),
      String(sum(member.pmCounts)),
    ]);
    rows.push([
      ...member.pmHours.map((hours) => (hours ? formatInr(hours, 1) : DASH)),
      formatInr(sum(member.pmHours), 1),
    ]);
  }
  // The plant total is the sum over the Settings team order: the platform reduces its
  // momPMHours rows in team order, and this code does the same.
  const counts = MONTHS.map((_, month) => sum(team.map((member) => member.pmCounts[month]!)));
  const hours = MONTHS.map((_, month) => sum(team.map((member) => member.pmHours[month]!)));
  rows.push([
    'PLANT TOTAL',
    ...counts.map((count) => (count ? String(count) : DASH)),
    String(sum(counts)),
  ]);
  rows.push([
    ...hours.map((value) => (value ? formatInr(value, 1) : DASH)),
    formatInr(sum(hours), 1),
  ]);
  return {
    title: 'Preventive Maintenance (PM) — Month-on-Month by Team Member',
    header: ['Name', ...MONTHS, 'Total'],
    rows,
    rowCount: rows.length,
  };
}

function specializationTable(members: readonly Member[], categories: readonly string[]) {
  return {
    title: 'Specialization',
    header: [
      'Name',
      ...categories.map((category) =>
        category.length > LABEL_LIMIT ? category.slice(0, LABEL_WIDTH) + '…' : category,
      ),
    ],
    rows: members.map((member) => [
      member.person.displayName,
      ...member.spec.map((count) => (count ? String(count) : DASH)),
    ]),
    rowCount: members.length,
  };
}

function breakdownTables(members: readonly Member[]) {
  const header = ['Name', ...MONTHS, 'Total'];
  return [
    {
      title: 'Month-on-Month — # Breakdowns Handled',
      header,
      rows: members.map((member) => [
        member.person.displayName,
        ...member.bdCounts.map((count) => (count ? String(count) : DASH)),
        String(sum(member.bdCounts)),
      ]),
      rowCount: members.length,
    },
    {
      title: 'Month-on-Month — BD Hours Handled',
      header,
      rows: members.map((member) => [
        member.person.displayName,
        ...member.bdHours.map((hours) => (hours ? formatInr(hours, 1) : DASH)),
        formatInr(sum(member.bdHours), 1),
      ]),
      rowCount: members.length,
    },
  ];
}

function countChart(members: readonly Member[]) {
  const plotted = members.filter((member) => member.doneCount > 0);
  return {
    id: 'ch-a4-count',
    type: 'bar',
    axes: { x: '', y: '' },
    tickLabels: { x: [], y: [] },
    labels: plotted.map((member) => member.person.displayName),
    datasets: [{ label: '# Breakdowns', data: plotted.map((member) => member.doneCount) }],
  };
}

/**
 * The A4 figure: the key's page whole. An empty plant (no production breakdown or no team) has no page to print,
 * so the value is null rather than a fabricated zero. The drill names the production non-PM tickets it read.
 */
export const a4ManpowerFigure: Computer = ({ data, asOf }) => {
  const ctx = buildContext(data, asOf);
  if (ctx.totalBD === 0 || ctx.members.length === 0) return { value: null, drillIds: [] };
  const byDone = [...ctx.members].sort((left, right) => right.doneCount - left.doneCount);
  const byPm = [...ctx.members].sort((left, right) => sum(right.pmCounts) - sum(left.pmCounts));
  const value = {
    screen: 'a4-manpower',
    asOf,
    pages: [
      {
        page: 'a4',
        title: 'Manpower Efficiency',
        kpis: kpis(ctx),
        tables: [
          manpowerTable(byDone, ctx.totalBD),
          pmTable(byPm, ctx.members),
          specializationTable(ctx.members, ctx.categories),
          ...breakdownTables(ctx.members),
        ],
        charts: [countChart(byDone)],
      },
    ],
  };
  return { value: value as unknown as FigureValue, drillIds: ctx.drillIds };
};
