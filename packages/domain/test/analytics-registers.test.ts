import { readFileSync } from 'node:fs';
import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { runWith, type EngineData, type EngineResult, type FigureResult } from '../src/index.js';
import { COMPUTERS } from '../src/analytics/computers.js';
import { ENGINE_DATA } from './answer-key/fixture.js';

/**
 * The five figures of ticket 39 (packet 39a) against the 11 November platform: the registers' own splits, the
 * footprint, the age analysis, one machine's page and the cell change log. Every number and every printed text is
 * the key's own, with no tolerance; the formulas are the platform Guide's (Section 7, 11 and 12 and the machine
 * detail card). Each figure names the rows a drill opens, in the frozen value shapes of the slice's revision.
 */

const AS_OF = '2026-11-11';

interface ScreenKpi {
  label: string;
  value: string;
  sub: string;
}
interface ScreenTable {
  title: string;
  header: string[];
  rows: string[][];
}
interface ScreenPage {
  page: string;
  title: string;
  kpis: ScreenKpi[];
  tables: ScreenTable[];
  text?: string;
}
interface ScreenKey {
  screen: string;
  asOf: string;
  pages: ScreenPage[];
}
interface MachineKey {
  id: string;
  segment: string;
  category: string;
  make: string;
  model: string;
  serial: string;
  controller: string;
  ctrlModel: string;
  ctrlSerial: string;
  year: number;
  datePurchase: string;
  power: number;
  location: string;
  cell: string;
  assetCode: string;
  length: number;
  width: number;
  conveyor: string;
  efficiency: string;
}

const readKey = <T>(name: string): T =>
  JSON.parse(
    readFileSync(new URL(`../../../fixtures/answer-key/${name}`, import.meta.url), 'utf8'),
  ) as T;

const REGISTERS = readKey<ScreenKey>('registers.json');
const FOOTPRINT = readKey<ScreenKey>('a7-footprint.json');
const AGE = readKey<ScreenKey>('a8-age.json');
const MACHINE_PAGE = readKey<
  ScreenKey & { extra: { machine: MachineKey; efficiencyPct: number; breakdowns: number } }
>('machine-page.json');

const run = (data: EngineData = ENGINE_DATA): EngineResult =>
  runWith(COMPUTERS, { data, asOf: AS_OF, profile: DEFAULT_PROFILE });

function figure(result: EngineResult, key: string): FigureResult {
  const found = result.figures.find((candidate) => candidate.key === key);
  if (!found) throw new Error(`no figure ${key}`);
  return found;
}

function valueOf<T>(result: EngineResult, key: string): T {
  return figure(result, key).value as unknown as T;
}

const machineIds = new Set(ENGINE_DATA.machines.map((machine) => machine.id));
const moveIds = new Set(ENGINE_DATA.moves.map((move) => move.id));
const ticketIds = new Set(
  [...ENGINE_DATA.tickets, ...ENGINE_DATA.tasks].map((ticket) => ticket.id),
);

/** The machine-page key's own KPI by label, so the record is checked against what the platform printed. */
function detailKpi(label: string): ScreenKpi {
  const page = MACHINE_PAGE.pages.find((candidate) => candidate.page === 'mdetail');
  const found = page?.kpis.find((kpi) => kpi.label === label);
  if (!found) throw new Error(`the machine-page key holds no KPI "${label}"`);
  return found;
}

/** The machine-page key prints MTBF in its long record text, not in a KPI. */
function detailText(pattern: RegExp): string {
  const page = MACHINE_PAGE.pages.find((candidate) => candidate.page === 'asset');
  const found = pattern.exec(page?.text ?? '');
  if (!found?.[1]) throw new Error(`the machine-page key holds no "${pattern}"`);
  return found[1];
}

const PLANT_DATE = /^(\d{2})-(\d{2})-(\d{4})$/;
const isoDate = (printed: string): string => {
  const [, day, month, year] = PLANT_DATE.exec(printed) ?? [];
  if (!day || !month || !year) throw new Error(`not a DD-MM-YYYY date: ${printed}`);
  return `${year}-${month}-${day}`;
};
const displayDate = (iso: string): string =>
  `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;

describe('the five owner-39 figures on the 11 November workbook', () => {
  const result = run();

  it("shows every register page's KPIs and its machine list exactly as the key printed them", () => {
    expect(REGISTERS.asOf).toBe(AS_OF);
    const pages = valueOf<{ pages: ScreenPage[] }>(result, 'registers').pages;
    expect(pages.map(({ page, title, kpis }) => ({ page, title, kpis }))).toEqual(
      REGISTERS.pages.map(({ page, title, kpis }) => ({ page, title, kpis })),
    );
    for (const page of REGISTERS.pages) {
      const ours = pages.find((candidate) => candidate.page === page.page);
      const keyTable = page.tables.find((table) =>
        table.header.some((header) => header === 'Machine ID' || header === 'DG ID'),
      );
      if (!keyTable) throw new Error(`the register key holds no machine list on ${page.page}`);
      const { title, header, rows } = keyTable;
      expect(ours?.tables[0], page.page).toEqual({ title, header, rows });
    }
    // The controller split merges spellings ("Fanuc Oi TF" and "FANUC OI-TF" are one series).
    const cnc = pages.find((page) => page.page === 'machines');
    expect(cnc?.kpis.filter((kpi) => kpi.label === 'Fanuc').length).toBe(1);
  });

  it("answers the footprint's cards and per-category table exactly, with the Guide's packing", () => {
    expect(FOOTPRINT.asOf).toBe(AS_OF);
    const page = valueOf<{ pages: ScreenPage[] }>(result, 'a7-footprint').pages[0]!;
    expect({ page: page.page, title: page.title, kpis: page.kpis }).toEqual({
      page: FOOTPRINT.pages[0]!.page,
      title: FOOTPRINT.pages[0]!.title,
      kpis: FOOTPRINT.pages[0]!.kpis,
    });
    const { title, header, rows } = FOOTPRINT.pages[0]!.tables[0]!;
    expect(page.tables[0]).toEqual({ title, header, rows });
  });

  it("answers the age analysis' band and average cards exactly as the key", () => {
    expect(AGE.asOf).toBe(AS_OF);
    const page = valueOf<{ pages: ScreenPage[] }>(result, 'a8-age').pages[0]!;
    expect({ page: page.page, title: page.title, kpis: page.kpis, tables: page.tables }).toEqual({
      page: AGE.pages[0]!.page,
      title: AGE.pages[0]!.title,
      kpis: AGE.pages[0]!.kpis,
      tables: AGE.pages[0]!.tables,
    });
  });

  it("shows VC-28's page with the nameplate, age, area, load, breakdown summary and completeness", () => {
    const record = valueOf<{ byMachine: Record<string, MachineRecord> }>(result, 'machine-page')
      .byMachine['VC-28'];
    if (!record) throw new Error('the machine page holds no VC-28');
    const key = MACHINE_PAGE.extra.machine;
    expect(record.machine).toEqual({
      id: key.id,
      code: key.id,
      segment: key.segment,
      category: key.category,
      make: key.make,
      model: key.model,
      serial: key.serial,
      controller: key.controller,
      controllerModel: key.ctrlModel,
      controllerSerial: key.ctrlSerial,
      year: key.year,
      purchasedOn: key.datePurchase,
      powerKva: key.power,
      capacityKva: null,
      location: key.location,
      cell: key.cell,
      assetCode: key.assetCode,
      lengthMm: key.length,
      widthMm: key.width,
      conveyor: key.conveyor,
    });
    expect(record.ageYears).toBe(4);
    expect(record.ageEstimated).toBe(false);
    expect(record.floorAreaM2).toBe((key.length * key.width) / 1e6);
    expect(record.efficiencyPct).toBe(MACHINE_PAGE.extra.efficiencyPct);
    expect(record.connectedKva).toBe(key.power);
    expect(record.runningKva).toBe((key.power * MACHINE_PAGE.extra.efficiencyPct) / 100);
    expect(record.completeness).toEqual({ recorded: 10, of: 10, missing: [] });
    expect(record.moves).toEqual([]);
    expect(record.breakdowns?.count).toBe(MACHINE_PAGE.extra.breakdowns);
    expect(record.pm).toEqual({ visits: 0, hours: 0 });
  });

  it("reads the machine's breakdown summary from its own answered rows, as the key prints it", () => {
    const record = valueOf<{ byMachine: Record<string, MachineRecord> }>(result, 'machine-page')
      .byMachine['VC-28'];
    if (!record?.breakdowns) throw new Error('the machine page holds no VC-28 breakdowns');
    const table = MACHINE_PAGE.pages.find((page) => page.page === 'mdetail')!.tables[0]!;
    const hours = table.rows.reduce(
      (sum, row) => sum + Number((row[6] ?? '').replace(' (NO DT)', '')),
      0,
    );
    const top = table.rows[0]!;
    const topCount = table.rows.filter((row) => row[3] === top[3]).length;
    const last =
      table.rows
        .map((row) => isoDate(row[1]!))
        .sort()
        .at(-1) ?? null;
    expect(record.breakdowns.topProblem).toEqual({ problem: top[3], count: topCount });
    expect(record.breakdowns.lastOn).toBe(last);
    expect(record.breakdowns.count).toBe(Number(detailKpi('Breakdowns').value));
    expect(record.breakdowns.hours).toBe(Number(detailKpi('BD Hours').value.replace(' hrs', '')));
    expect(record.breakdowns.hours).toBeCloseTo(hours, 10);
    expect(record.breakdowns.mttr).toBe(Number(detailKpi('MTTR').value.replace(' hrs', '')));
    expect(record.breakdowns.mtbf).toBe(Number(detailText(/MTBF \(annual basis\)([\d.]+) hrs/)));
    expect(record.breakdowns.mtbf).toBe(
      Math.round(((20 * 300 - record.breakdowns.hours) / record.breakdowns.count) * 10) / 10,
    );
    expect(record.drill.breakdowns.length).toBe(record.breakdowns.count);
    for (const id of record.drill.breakdowns) expect(ticketIds.has(id), id).toBe(true);
  });

  it("lists every cell move newest first with its ISO date and both changes, exactly as the key's table", () => {
    const page = REGISTERS.pages.find((candidate) => candidate.page === 'machines')!;
    const key = page.tables.find((table) => table.title === 'Cell / Location Change Log')!;
    const moves = valueOf<{ moves: CellMove[] }>(result, 'cell-change-log').moves;
    expect(
      moves.map((move) => [
        displayDate(move.date),
        move.machineId,
        `${move.fromCell ?? '—'} → ${move.toCell ?? ''}`.trim(),
        move.fromLocation === move.toLocation
          ? 'no change'
          : `${move.fromLocation ?? '—'} → ${move.toLocation ?? ''}`.trim(),
      ]),
    ).toEqual(key.rows.map((row) => row.slice(0, 4)));
    expect(moves.find((move) => move.machineId === 'TC-30')?.fromLocation).toBe(
      moves.find((move) => move.machineId === 'TC-30')?.toLocation,
    );
    for (const move of moves) expect(moveIds.has(move.id), move.id).toBe(true);
  });

  it('drills each figure to the rows its formula read, never to a row the data does not hold', () => {
    const registers = figure(result, 'registers');
    expect(registers.drill.type).toBe('machine');
    expect(registers.drill.ids.length).toBe(192);
    for (const id of registers.drill.ids) expect(machineIds.has(id), id).toBe(true);

    for (const key of ['a7-footprint', 'a8-age', 'machine-page']) {
      const drilled = figure(result, key);
      expect(drilled.drill.type, key).toBe('machine');
      expect(drilled.drill.ids.length, key).toBeGreaterThan(0);
      for (const id of drilled.drill.ids) expect(machineIds.has(id), `${key}: ${id}`).toBe(true);
    }
    const production = ENGINE_DATA.machines.filter(
      (machine) => machine.segment === 'CNC' && !machine.excludedFromProduction,
    );
    expect(figure(result, 'a7-footprint').drill.ids).toEqual(
      production.map((machine) => machine.id).sort(),
    );
    expect(figure(result, 'a8-age').drill.ids).toEqual(
      production.map((machine) => machine.id).sort(),
    );

    const cellLog = figure(result, 'cell-change-log');
    expect(cellLog.drill.type).toBe('move');
    expect(cellLog.drill.ids).toEqual([...moveIds].sort());
    expect(cellLog.drill.ids.length).toBe(15);
  });
});

/** The frozen machine-page record shape, as 39b consumes it. */
interface CellMove {
  id: string;
  machineId: string;
  date: string;
  fromCell: string | null;
  toCell: string | null;
  fromLocation: string | null;
  toLocation: string | null;
}
interface MachineRecord {
  machine: { id: string; [key: string]: unknown };
  ageYears: number | null;
  ageEstimated: boolean;
  floorAreaM2: number | null;
  efficiencyPct: number;
  connectedKva: number | null;
  runningKva: number | null;
  breakdowns: {
    count: number;
    hours: number;
    mttr: number | null;
    mtbf: number | null;
    lastOn: string | null;
    topProblem: { problem: string; count: number } | null;
  } | null;
  pm: { visits: number; hours: number } | null;
  completeness: { recorded: number; of: number; missing: string[] };
  moves: CellMove[];
  drill: { breakdowns: string[]; pm: string[]; moves: string[] };
}
describe('the figures read the data they are given', () => {
  const extraMachine = {
    ...ENGINE_DATA.machines[0]!,
    id: 'TEST-REG-1',
    code: 'TEST-REG-1',
    segment: 'CNC',
    category: 'Turning Center',
    year: 2026,
    purchasedOn: null,
    powerKw: 10,
    excludedFromProduction: false,
    metadata: { length: 2000, width: 2000, conveyor: 'L', efficiency: 25 },
  };

  it('counts an added CNC machine in its register and in the footprint, not a frozen number', () => {
    const before = run();
    const after = run({ ...ENGINE_DATA, machines: [...ENGINE_DATA.machines, extraMachine] });
    const cnc = (result: EngineResult) =>
      valueOf<{ pages: ScreenPage[] }>(result, 'registers').pages.find(
        (page) => page.page === 'machines',
      )!.kpis[0]!.value;
    expect(cnc(after)).toBe(String(Number(cnc(before)) + 1));
    expect(figure(after, 'a7-footprint').drill.ids).toContain(extraMachine.id);
  });

  it('moves a machine between age bands when its purchase date changes', () => {
    const band = (result: EngineResult, index: number) =>
      Number(
        valueOf<{ pages: ScreenPage[] }>(result, 'a8-age').pages[0]!.kpis[index]!.sub.split(
          ' ',
        )[0] ?? '0',
      );
    const before = run();
    const old = {
      ...ENGINE_DATA.machines.find((m) => m.id === 'VC-43')!,
      purchasedOn: '2000-01-01',
    };
    const after = run({
      ...ENGINE_DATA,
      machines: ENGINE_DATA.machines.map((m) => (m.id === old.id ? old : m)),
    });
    expect(band(after, 0)).toBe(band(before, 0) - 1);
    expect(band(after, 4)).toBe(band(before, 4) + 1);
  });
});
