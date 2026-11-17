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
  segment?: string;
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

/** Noon in the plant's own time zone on that plant date, so the day cut in `plantDay` lands on the same day. */
const instant = (date: string): string => `${date}T06:30:00.000Z`;

/** What the workbook keeps beside the columns: the footprint and conveyor side ticket 39 reads. */
function footprint(row: WorkbookMachine): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  if (row.length !== undefined) metadata.length = row.length;
  if (row.width !== undefined) metadata.width = row.width;
  if (row.conveyor) metadata.conveyor = row.conveyor;
  return metadata;
}

/** One workbook row as a machine; a list that is not the CNC master carries no segment of its own. */
function toMachine(row: WorkbookMachine, segment: string): MachineRow {
  return {
    id: row.id,
    code: row.id,
    segment: row.segment ?? segment,
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
    metadata: footprint(row),
  };
}

/** The workbook's five machine sheets, in the order the platform lists them. */
function machines(workbook: Workbook): MachineRow[] {
  const sheets: ReadonlyArray<[readonly WorkbookMachine[], string]> = [
    [workbook.machines, 'CNC'],
    [workbook.convMachines, 'Conventional'],
    [workbook.procMachines, 'Process'],
    [workbook.utilMachines, 'Utility'],
    [workbook.dgMachines, 'DG'],
  ];
  return sheets.flatMap(([rows, segment]) => rows.map((row) => toMachine(row, segment)));
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

/** Every breakdown row is one closed history ticket, under the workbook's own ticket or row id so a drill resolves. */
function toTicket(row: WorkbookBreakdown): TicketRow {
  const date = plantDate(row.date);
  return {
    id: row.ticketId ?? row.id,
    ref: row.ticketRef ?? row.id,
    kind: 'stopped',
    status: 'closed',
    machineId: row.machineId,
    reportedAt: instant(date),
    closedAt: instant(date),
    source: 'history',
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
  const rows = [...workbook.breakdowns, ...workbook.otherBD];
  return {
    timeZone: 'Asia/Kolkata',
    machines: machines(workbook),
    moves: [],
    tickets: rows.map(toTicket),
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

export interface DashboardKey {
  screen: string;
  asOf: string;
  pages: Array<{
    page: string;
    title: string;
    kpis: DashboardKpi[];
    tables: unknown[];
    charts: unknown[];
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
