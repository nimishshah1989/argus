import { readFileSync } from 'node:fs';
import type {
  EngineData,
  ListRow,
  MachineRow,
  PersonRow,
  ReportRow,
  TicketRow,
} from '../../src/index.js';

/**
 * The answer-key seam (ticket 38): `fixtures/answer-key/input.json` is the 11 November workbook in the shape the
 * platform keeps it, and `dashboard.json` is what the platform showed for it on 2026-11-11. The engines are pure, so
 * a domain test maps the workbook into `EngineData` once and runs `runWith` over it; no test and no production code
 * touches a database. This module is the model tickets 39 to 45 copy.
 *
 * The files are repo data and already pseudonymised (names are `Person 51`, machines, codes and timings are real).
 * Nothing here writes; a person is a slug of the workbook's coded name, never a new name.
 */

interface WorkbookMachine {
  id: string;
  category?: string;
  make?: string;
  model?: string;
  controller?: string;
  year?: number | string | null;
  datePurchase?: string;
  power?: number | string | null;
  capacityKva?: number;
  location?: string;
  cell?: string;
  assetCode?: string;
  length?: number;
  width?: number;
  conveyor?: string;
}

interface WorkbookBreakdown {
  id: string;
  machineId: string;
  /** The workbook writes plant dates as `DD-MM-YYYY`. */
  date: string;
  shift: string;
  problem: string;
  downMin?: number;
  respMin?: number;
  activeMin?: number;
  maintCode?: string;
  electMech?: string;
  spare1?: string;
  doneBy?: string;
  supportedBy?: string;
  ticketId?: string;
  ticketRef?: string;
}

interface Workbook {
  machines: WorkbookMachine[];
  convMachines: WorkbookMachine[];
  procMachines: WorkbookMachine[];
  utilMachines: WorkbookMachine[];
  dgMachines: WorkbookMachine[];
  breakdowns: WorkbookBreakdown[];
  otherBD: WorkbookBreakdown[];
  settings: {
    codes: Array<{ code: string; description: string }>;
    team: Array<{ name: string; type: string }>;
    /** The machines the plant leaves out of production data (the Robot is one). */
    excludedMachines?: string[];
    /** The plant's shifts, with the wall-clock start the log date belongs to. */
    shiftTimes: Array<{ name: string; start: string; end: string }>;
  };
}

function read<T>(name: string): T {
  const url = new URL(`../../../../fixtures/answer-key/${name}`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8')) as T;
}

const number = (value: number | string | null | undefined): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const text = (value: string | undefined): string | null =>
  value !== undefined && value.trim() !== '' ? value.trim() : null;

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

/** What the workbook keeps beside the columns: the footprint and conveyor side ticket 39 reads. */
function footprint(row: WorkbookMachine): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  if (row.length !== undefined) metadata.length = row.length;
  if (row.width !== undefined) metadata.width = row.width;
  if (row.conveyor) metadata.conveyor = row.conveyor;
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

function personCodes(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map(personCode)
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
    doneBy: personCodes(row.doneBy),
    supportedBy: personCodes(row.supportedBy),
  };
}

/** The coded names the rows and the team settings use, never a real one. */
function people(workbook: Workbook, rows: readonly WorkbookBreakdown[]): PersonRow[] {
  const team = new Map<string, PersonRow['team']>();
  for (const member of workbook.settings.team) {
    team.set(personCode(member.name), member.type === 'Vendor' ? 'vendor' : 'maintenance');
  }
  for (const row of rows) {
    for (const code of [...personCodes(row.doneBy), ...personCodes(row.supportedBy)]) {
      if (!team.has(code)) team.set(code, 'maintenance');
    }
  }
  return [...team].map(([code, kind]) => ({ id: code, code, team: kind, active: true }));
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

function engineData(workbook: Workbook): EngineData {
  const history = workbook.breakdowns;
  const live = workbook.otherBD;
  const rows = [...history, ...live];
  return {
    timeZone: 'Asia/Kolkata',
    machines: machines(workbook),
    moves: [],
    tickets: [
      ...history.map((row) => toTicket(workbook, row, 'history')),
      ...live.map((row) => toTicket(workbook, row, 'live')),
    ],
    // The workbook links no follow-up job to a parent ticket, so there is no task to shape.
    tasks: [],
    reports: rows.map(toReport),
    people: people(workbook, rows),
    lists: lists(workbook),
  };
}

/** The workbook as the engine reads it. Test-only: no production module imports this fixture. */
export const ENGINE_DATA: EngineData = engineData(read<Workbook>('input.json'));

export interface DashboardKpi {
  label: string;
  value: string;
  sub: string;
}

export interface DashboardDataset {
  label: string;
  data: unknown[];
}

/** One chart as the platform drew it: the series and the axes, with the canvas type dropped. */
export interface DashboardChart {
  id: string;
  axes: Record<string, string>;
  tickLabels: Record<string, string[]>;
  labels: unknown[];
  datasets: DashboardDataset[];
}

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
