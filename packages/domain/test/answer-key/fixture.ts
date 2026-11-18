import type {
  EngineData,
  ListRow,
  MachineRow,
  MoveRow,
  PersonRow,
  ReportRow,
  TicketRow,
} from '../../src/index.js';
import { read, type DashboardChart, type DashboardKpi, type FigureKey } from './keys.js';
import type { Workbook, WorkbookBreakdown, WorkbookMachine } from './workbook.js';

export * from './keys.js';

/**
 * The answer-key seam (ticket 38): `fixtures/answer-key/input.json` is the 11 November workbook in the shape the
 * platform keeps it, and `dashboard.json` is what the platform showed for it on 2026-11-11. The engines are pure, so
 * a domain test maps the workbook into `EngineData` once and runs `runWith` over it; no test and no production code
 * touches a database. This module is the model tickets 39 to 45 copy.
 *
 * The files are repo data and already pseudonymised (names are `Person 51`, machines, codes and timings are real).
 * Nothing here writes; a person keeps the workbook's coded name beside a slug of it, never a new name.
 */

const number = (value: number | string | null | undefined): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const text = (value: string | number | undefined): string | null =>
  value !== undefined && String(value).trim() !== '' ? String(value).trim() : null;

/** The plant date (`YYYY-MM-DD`) of a workbook date (`DD-MM-YYYY`). */
function plantDate(workbookDate: string): string {
  const [day, month, year] = workbookDate.split('-');
  if (!day || !month || !year) throw new Error(`not a DD-MM-YYYY date: ${workbookDate}`);
  return `${year}-${month}-${day}`;
}

/** The workbook spells some shifts `1ST` and `2ND`; the settings give them as `1` and `2`. */
const SHIFT_ALIASES: Record<string, string> = { '1ST': '1', '2ND': '2' };

/**
 * The plant instant a row starts at: its log date at the shift's start in the plant's own time zone (the settings'
 * `shiftTimes`), as `plantDay` reads the cut. A shift the settings give no start for (the workbook has a few `3`
 * rows) starts with the day shift, so its plant date stays the row's date.
 */
function shiftStart(workbook: Workbook, shift: string): string {
  const name = SHIFT_ALIASES[shift.trim().toUpperCase()] ?? shift.trim();
  const times = workbook.settings.shiftTimes;
  return times.find((time) => time.name === name)?.start ?? times[0]?.start ?? '08:00';
}

/** A workbook date and shift as the plant instant it starts at. Asia/Kolkata has no daylight saving. */
const reportedAt = (workbook: Workbook, row: WorkbookBreakdown): string =>
  new Date(`${plantDate(row.date)}T${shiftStart(workbook, row.shift)}:00+05:30`).toISOString();

/** The instant the breakdown closed: its start plus the recorded downtime. */
function closedAt(start: string, row: WorkbookBreakdown): string {
  return new Date(new Date(start).getTime() + (row.downMin ?? 0) * 60_000).toISOString();
}

/** What the workbook keeps beside the columns: the footprint, conveyor side and per-machine efficiency ticket 39 reads. */
function footprint(row: WorkbookMachine): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  if (row.length !== undefined && row.length !== '') metadata.length = row.length;
  if (row.width !== undefined && row.width !== '') metadata.width = row.width;
  if (row.conveyor) metadata.conveyor = row.conveyor;
  if (row.efficiency !== undefined && row.efficiency !== '') metadata.efficiency = row.efficiency;
  return metadata;
}

/** One workbook row as a machine: the list it is in is its segment, since a list row carries none of its own. */
function toMachine(
  row: WorkbookMachine,
  segment: string,
  excluded: ReadonlySet<string>,
): MachineRow {
  return {
    id: row.id,
    code: row.id,
    segment,
    category: text(row.category),
    cell: text(row.cell),
    location: text(row.location),
    make: text(row.make),
    model: text(row.model),
    controller: text(row.controller),
    serial: text(row.serial),
    controllerModel: text(row.ctrlModel),
    controllerSerial: text(row.ctrlSerial),
    year: number(row.year),
    purchasedOn: text(row.datePurchase),
    powerKw: number(row.power),
    capacityKva: number(row.capacityKva),
    assetCode: text(row.assetCode),
    status: 'active',
    criticality: null,
    // The plant's Settings list names the Robot; a row whose category is Robot is out of production data too.
    excludedFromProduction: excluded.has(row.id) || row.category === 'Robot',
    metadata: footprint(row),
  };
}

/** The workbook's five machine sheets, in the order the platform lists them. */
function machines(workbook: Workbook): MachineRow[] {
  const excluded = new Set(workbook.settings.excludedMachines ?? []);
  const sheets: ReadonlyArray<[readonly WorkbookMachine[], string]> = [
    [workbook.machines, 'CNC'],
    [workbook.convMachines, 'Conventional'],
    [workbook.procMachines, 'Process'],
    [workbook.utilMachines, 'Utility'],
    [workbook.dgMachines, 'DG'],
  ];
  return sheets.flatMap(([rows, segment]) => rows.map((row) => toMachine(row, segment, excluded)));
}

/** A coded name (`Person 51`, `Maint. Team`) as the engine's person code. The workbook holds no other name. */
const personCode = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** The coded names a workbook cell lists: comma-separated, trimmed, an empty cell naming nobody. */
function personNames(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '');
}

/** The R8 mention repair (`fixtures/answer-key/person-mentions.json`, and the README's why): one coded slot. */
interface PersonMention {
  reportId: string;
  field: 'doneBy' | 'supportedBy';
  token: string;
  code: string;
}

interface MentionFile {
  /** Why the map exists; the fixture reads the data, a person reads this. */
  why: string;
  mentions: PersonMention[];
  /** Each mention code's printed name, so a figure keeps printing what the log printed. */
  displayNames: Record<string, string>;
}

const MENTIONS = read<MentionFile>('person-mentions.json');

/** `reportId|field|token`: the exact slot the repair moves, so the other names in the cell stay untouched. */
const MENTION_CODES = new Map<string, string>(
  MENTIONS.mentions.map((mention) => [
    `${mention.reportId}|${mention.field}|${mention.token}`,
    mention.code,
  ]),
);

/**
 * The coded names a workbook cell lists, with the R8 repair applied. The pseudonymiser collapses every name form
 * of a person to one code, so the nine mentions the platform attributed by an exact full name get their own code.
 */
function personCodes(
  reportId: string,
  field: PersonMention['field'],
  value: string | undefined,
): string[] {
  return personNames(value)
    .map((name) => MENTION_CODES.get(`${reportId}|${field}|${name}`) ?? personCode(name))
    .filter((code) => code !== '');
}

/**
 * Every breakdown row is one closed ticket, under the workbook's own ticket or row id so a drill resolves. A row of
 * the log is `history`; a row the live app recorded is `live`, and the key counts the two differently per figure.
 */
function toTicket(
  workbook: Workbook,
  row: WorkbookBreakdown,
  source: TicketRow['source'],
): TicketRow {
  const start = reportedAt(workbook, row);
  return {
    id: row.ticketId ?? row.id,
    ref: row.ticketRef ?? row.id,
    kind: 'stopped',
    status: 'closed',
    machineId: row.machineId,
    reportedAt: start,
    closedAt: closedAt(start, row),
    source,
    downtimeMin: number(row.downMin),
    repairMin: number(row.activeMin),
    workType: text(row.maintCode),
  };
}

/** The report the same row wrote when the breakdown was closed. */
function toReport(row: WorkbookBreakdown): ReportRow {
  return {
    id: row.id,
    ticketId: row.ticketId ?? row.id,
    machineId: row.machineId,
    date: plantDate(row.date),
    shift: row.shift,
    problem: row.problem,
    downtimeMin: number(row.downMin) ?? 0,
    responseMin: number(row.respMin),
    repairMin: number(row.activeMin),
    category: text(row.electMech),
    maintCode: text(row.maintCode),
    spareUsed: text(row.spare1),
    rootCause: null,
    correctiveAction: text(row.correctiveAction),
    doneBy: personCodes(row.id, 'doneBy', row.doneBy),
    supportedBy: personCodes(row.id, 'supportedBy', row.supportedBy),
    recordedHours: number(row.downHrs),
    srNo: number(row.srNo),
    observedBy: text(row.observedBy),
  };
}

/** The coded names the rows and the team settings use, never a real one. */
function people(workbook: Workbook, rows: readonly WorkbookBreakdown[]): PersonRow[] {
  const team = new Map<string, PersonRow['team']>();
  const names = new Map<string, string>();
  const remember = (name: string): void => {
    const code = personCode(name);
    if (code !== '' && !names.has(code)) names.set(code, name.trim());
  };
  for (const member of workbook.settings.team) {
    remember(member.name);
    team.set(personCode(member.name), member.type === 'Vendor' ? 'vendor' : 'maintenance');
  }
  for (const row of rows) {
    for (const name of [...personNames(row.doneBy), ...personNames(row.supportedBy)]) {
      remember(name);
      const code = personCode(name);
      if (code !== '' && !team.has(code)) team.set(code, 'maintenance');
    }
  }
  // The R8 mention codes are people too: each keeps the printed name, so the log prints what it printed before.
  for (const [code, displayName] of Object.entries(MENTIONS.displayNames)) {
    team.set(code, 'maintenance');
    names.set(code, displayName);
  }
  return [...team].map(([code, kind]) => ({
    id: code,
    code,
    displayName: names.get(code) ?? code,
    team: kind,
    active: true,
  }));
}

/** The maintenance codes the rows carry; a row names one, so the list holds them. */
function lists(workbook: Workbook): Record<string, ListRow[]> {
  const maintCodes = workbook.settings.codes.map(({ code, description }) => ({
    code,
    label: description,
    active: true,
  }));
  return maintCodes.length > 0 ? { maint_code: maintCodes } : {};
}

/** The workbook's cell change log as the engine's moves: the plant date it takes effect, both cells and locations. */
function moves(workbook: Workbook): MoveRow[] {
  return (workbook.cellChangeLog ?? []).map((row) => ({
    id: row.id,
    machineId: row.machineId,
    fromCell: text(row.fromCell),
    toCell: text(row.toCell),
    fromLocation: text(row.fromLocation),
    toLocation: text(row.toLocation),
    effectiveFrom: plantDate(row.date),
  }));
}

function engineData(workbook: Workbook): EngineData {
  const history = workbook.breakdowns;
  const live = workbook.otherBD;
  const rows = [...history, ...live];
  return {
    timeZone: 'Asia/Kolkata',
    machines: machines(workbook),
    moves: moves(workbook),
    tickets: [
      ...history.map((row) => toTicket(workbook, row, 'history')),
      ...live.map((row) => toTicket(workbook, row, 'live')),
    ],
    // The workbook links no follow-up job to a parent ticket, so there is no task to shape.
    tasks: [],
    reports: rows.map(toReport),
    people: people(workbook, rows),
    lists: lists(workbook),
    settings: {
      excludedMachineIds: workbook.settings.excludedMachines ?? [],
      problemFixes: workbook.settings.problemFix ?? {},
      // The Settings team list in its own order (R6): the plant's list, not a filter over the people rows.
      teamCodes: workbook.settings.team.map((member) => personCode(member.name)),
    },
    // No Why-Why record exists in the workbook: ticket 41's form writes one, and the figure reads it here.
    whyWhy: [],
  };
}

/** The workbook as the engine reads it. Test-only: no production module imports this fixture. */
export const ENGINE_DATA: EngineData = engineData(read<Workbook>('input.json'));

export interface DashboardKey {
  screen: string;
  asOf: string;
  pages: Array<{
    page: string;
    title: string;
    kpis: DashboardKpi[];
    tables: unknown[];
    charts: DashboardChart[];
    text: string;
  }>;
}

/** What the platform showed on the Dashboard for `input.json`, frozen on 2026-11-11. */
export const DASHBOARD: DashboardKey = read<DashboardKey>('dashboard.json');

/** The answer key's KPI by its own label. A label the key does not hold is a test bug, so it throws. */
export function kpiByLabel(label: string): DashboardKpi {
  for (const page of DASHBOARD.pages) {
    const found = page.kpis.find((kpi) => kpi.label === label);
    if (found) return found;
  }
  throw new Error(`the answer key holds no KPI labelled "${label}"`);
}

/** The Dashboard chart the engine must reproduce, by the platform's own canvas id. */
export function chartById(id: string): DashboardChart {
  for (const page of DASHBOARD.pages) {
    const found = page.charts.find((chart) => chart.id === id);
    if (found) return found;
  }
  throw new Error(`the answer key holds no chart "${id}"`);
}

export interface ChecklistItem {
  group: string;
  key: string;
  plain: string;
}

export interface ChecklistKey {
  screen: string;
  asOf: string;
  extra: { counts: Record<string, number>; items: ChecklistItem[] };
}

/** The Data Checklist the platform showed for `input.json`: the open items and their per-group counts. */
export const CHECKLIST: ChecklistKey = read<ChecklistKey>('data-checklist.json');

/** The four breakdown figures of ticket 40, frozen on 2026-11-11 (the same workbook `ENGINE_DATA` holds). */
export const BREAKDOWN_LOG: FigureKey = read<FigureKey>('breakdown-log.json');
export const A1: FigureKey = read<FigureKey>('a1-bd-pm.json');
export const A2: FigureKey = read<FigureKey>('a2-category-cell.json');
export const A3: FigureKey = read<FigureKey>('a3-mttr-mtbf.json');
