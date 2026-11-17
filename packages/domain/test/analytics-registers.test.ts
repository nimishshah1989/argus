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
 * detail card). Each figure names the rows a drill opens.
 */

const AS_OF = '2026-11-11';

/** A screen key file as the platform printed it: the page titles and their KPI texts and tables. */
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

interface RegisterPage {
  page: string;
  title: string;
  kpis: ScreenKpi[];
}
interface FootprintValue {
  kpis: ScreenKpi[];
  tables: Array<{ title: string; header: string[]; rows: string[][] }>;
}
interface AgeValue {
  kpis: ScreenKpi[];
}
interface MachineRecord {
  id: string;
  segment: string | null;
  category: string | null;
  make: string | null;
  model: string | null;
  serial: string | null;
  assetCode: string | null;
  controller: string | null;
  controllerModel: string | null;
  controllerSerial: string | null;
  year: number | null;
  purchasedOn: string | null;
  ageYears: number | null;
  ageBasis: 'purchase' | 'estimated' | null;
  location: string | null;
  cell: string | null;
  conveyor: string | null;
  lengthMm: number | null;
  widthMm: number | null;
  floorAreaM2: number | null;
  connectedKva: number | null;
  runningKva: number | null;
  efficiencyPct: number;
  supplyKva: number | null;
  breakdowns: number;
  bdHours: number;
  mttrHours: number | null;
  mtbfHours: number | null;
  pmVisits: number;
  pmHours: number;
  lastBreakdown: string | null;
  topProblem: { problem: string; count: number } | null;
  completeness: { filled: number; total: number };
  moves: Array<{
    id: string;
    date: string;
    fromCell: string | null;
    toCell: string | null;
    fromLocation: string | null;
    toLocation: string | null;
  }>;
}
interface MachinePageValue {
  records: MachineRecord[];
}
interface CellLogValue {
  rows: Array<{
    id: string;
    date: string;
    machineId: string;
    fromCell: string | null;
    toCell: string | null;
    fromLocation: string | null;
    toLocation: string | null;
    cellChange: string;
    locationChange: string;
  }>;
}

const machineIds = new Set(ENGINE_DATA.machines.map((machine) => machine.id));
const moveIds = new Set(ENGINE_DATA.moves.map((move) => move.id));

/** The machine-page key's own KPI by label, so the record is checked against what the platform printed. */
function detailKpi(label: string): ScreenKpi {
  const page = MACHINE_PAGE.pages.find((candidate) => candidate.page === 'mdetail');
  const found = page?.kpis.find((kpi) => kpi.label === label);
  if (!found) throw new Error(`the machine-page key holds no KPI "${label}"`);
  return found;
}

/** A value the machine-page key prints in its long record text, never in a KPI. */
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

describe('the five owner-39 figures on the 11 November workbook', () => {
  const result = run();

  it("shows every register page's titles and KPI texts exactly as the key printed them", () => {
    expect(REGISTERS.asOf).toBe(AS_OF);
    const pages = valueOf<{ pages: RegisterPage[] }>(result, 'registers').pages;
    expect(pages).toEqual(
      REGISTERS.pages.map((page) => ({ page: page.page, title: page.title, kpis: page.kpis })),
    );
    // The controller split merges spellings ("Fanuc Oi TF" and "FANUC OI-TF" are one series): the two are one card.
    const cnc = pages.find((page) => page.page === 'machines');
    expect(cnc?.kpis.filter((kpi) => kpi.label === 'Fanuc').length).toBe(1);
  });

  it("answers the footprint's KPI texts and its per-category table exactly, with the Guide's packing", () => {
    expect(FOOTPRINT.asOf).toBe(AS_OF);
    const footprint = valueOf<FootprintValue>(result, 'a7-footprint');
    expect(footprint.kpis).toEqual(FOOTPRINT.pages[0]!.kpis);
    const category = FOOTPRINT.pages[0]!.tables[0]!;
    expect(footprint.tables[0]!.title).toBe(category.title);
    expect(footprint.tables[0]!.header).toEqual(category.header);
    expect(footprint.tables[0]!.rows).toEqual(category.rows);
  });

  it("answers the age analysis' band and average KPI texts exactly as the key", () => {
    expect(AGE.asOf).toBe(AS_OF);
    expect(valueOf<AgeValue>(result, 'a8-age').kpis).toEqual(AGE.pages[0]!.kpis);
  });

  it("shows VC-28's page with the nameplate, age, area, load, breakdown summary and completeness", () => {
    const record = valueOf<MachinePageValue>(result, 'machine-page').records.find(
      (candidate) => candidate.id === 'VC-28',
    );
    if (!record) throw new Error('the machine page holds no VC-28');
    const key = MACHINE_PAGE.extra.machine as unknown as MachineKey;
    expect(record).toMatchObject({
      id: key.id,
      segment: key.segment,
      category: key.category,
      make: key.make,
      model: key.model,
      serial: key.serial,
      assetCode: key.assetCode,
      controller: key.controller,
      controllerModel: key.ctrlModel,
      controllerSerial: key.ctrlSerial,
      year: key.year,
      purchasedOn: key.datePurchase,
      ageYears: 4,
      ageBasis: 'purchase',
      location: key.location,
      cell: key.cell,
      conveyor: key.conveyor,
      lengthMm: key.length,
      widthMm: key.width,
      floorAreaM2: (key.length * key.width) / 1e6,
      connectedKva: key.power,
      efficiencyPct: MACHINE_PAGE.extra.efficiencyPct,
    });
    expect(record.runningKva).toBe((key.power * MACHINE_PAGE.extra.efficiencyPct) / 100);
    expect(record.completeness).toEqual({ filled: 10, total: 10 });
    expect(record.moves).toEqual([]);
    expect(record.breakdowns).toBe(MACHINE_PAGE.extra.breakdowns);
    expect(record.pmVisits).toBe(0);
    expect(record.pmHours).toBe(0);
  });

  it("reads the machine's breakdown summary from its own answered rows, as the key prints it", () => {
    const record = valueOf<MachinePageValue>(result, 'machine-page').records.find(
      (candidate) => candidate.id === 'VC-28',
    );
    if (!record) throw new Error('the machine page holds no VC-28');
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
    expect(record.topProblem).toEqual({ problem: top[3], count: topCount });
    expect(record.lastBreakdown).toBe(last);
    expect(record.breakdowns).toBe(Number(detailKpi('Breakdowns').value));
    expect(record.bdHours).toBe(Number(detailKpi('BD Hours').value.replace(' hrs', '')));
    expect(record.bdHours).toBeCloseTo(hours, 10);
    expect(record.mttrHours).toBe(Number(detailKpi('MTTR').value.replace(' hrs', '')));
    expect(record.mtbfHours).toBe(Number(detailText(/MTBF \(annual basis\)([\d.]+) hrs/)));
    expect(record.mtbfHours).toBe(
      Math.round(((20 * 300 - record.bdHours) / record.breakdowns) * 10) / 10,
    );
  });

  it("lists every cell move with its date, machine and both changes, exactly as the key's table", () => {
    const page = REGISTERS.pages.find((candidate) => candidate.page === 'machines')!;
    const key = page.tables.find((table) => table.title === 'Cell / Location Change Log')!;
    const rows = valueOf<CellLogValue>(result, 'cell-change-log').rows;
    expect(
      rows.map((row) => [row.date, row.machineId, row.cellChange, row.locationChange]),
    ).toEqual(key.rows.map((row) => row.slice(0, 4)));
    expect(rows.find((row) => row.machineId === 'TC-30')?.locationChange).toBe('no change');
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
      valueOf<{ pages: RegisterPage[] }>(result, 'registers').pages.find(
        (page) => page.page === 'machines',
      )!.kpis[0]!.value;
    expect(cnc(after)).toBe(String(Number(cnc(before)) + 1));
    expect(figure(after, 'a7-footprint').drill.ids).toContain(extraMachine.id);
  });

  it('moves a machine between age bands when its purchase date changes', () => {
    const band = (result: EngineResult, index: number) =>
      Number(valueOf<AgeValue>(result, 'a8-age').kpis[index]!.sub.split(' ')[0] ?? '0');
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
