import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import type {
  EngineData,
  MachineRow,
  OemCauseRow,
  ReportRow,
  TicketRow,
} from '../../src/analytics/types.js';
import { oemAnalyticsFigure } from '../../src/analytics/oem.js';

/**
 * Hidden edges for OEM Analytics (ticket 812). A hand-made plant on 11 Nov 2026, ids are UUIDs, codes invented:
 * Y-1 bought 2026-06-01 (163 days) and Y-2 bought 2026-09-01 (71 days) are young; O-1 bought 2020 is the older peer;
 * N-1 has no purchase date and is in neither group. Young breakdowns: A on Y-1 2026-07-01 4 h, B on Y-1 2026-08-01
 * 2 h, C on Y-2 2026-10-01 1 h = 3 breakdowns, 7 h. A PM on Y-1 (3 h) and N-1's 6 h breakdown never count.
 */

const AS_OF = '2026-11-11';
const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const MACHINE = { Y1: uuid(1), Y2: uuid(2), O1: uuid(3), N1: uuid(4) };
const TICKET = { A: uuid(11), B: uuid(12), C: uuid(13), PM: uuid(14), O: uuid(15), N: uuid(16) };

const machine = (id: string, code: string, purchasedOn: string | null): MachineRow => ({
  id,
  code,
  segment: 'CNC',
  category: 'Turning Center',
  cell: 'Cell 1',
  location: 'Shop 1',
  make: 'ACME',
  model: 'T1',
  controller: null,
  year: null,
  purchasedOn,
  powerKw: 10,
  capacityKva: 10,
  assetCode: null,
  status: 'active',
  criticality: 'B',
  excludedFromProduction: false,
  metadata: {},
});

type Entry = readonly [ticket: string, machine: string, day: string, hours: number, pm?: boolean];
const ENTRIES: readonly Entry[] = [
  [TICKET.A, MACHINE.Y1, '2026-07-01', 4],
  [TICKET.B, MACHINE.Y1, '2026-08-01', 2],
  [TICKET.C, MACHINE.Y2, '2026-10-01', 1],
  [TICKET.PM, MACHINE.Y1, '2026-08-15', 3, true],
  [TICKET.O, MACHINE.O1, '2026-03-01', 5],
  [TICKET.N, MACHINE.N1, '2026-05-01', 6],
];

const ticket = ([id, machineId, day, hours]: Entry): TicketRow => ({
  id,
  ref: `BD-${id.slice(-2)}`,
  kind: 'stopped',
  status: 'closed',
  machineId,
  reportedAt: `${day}T04:00:00.000Z`,
  closedAt: new Date(Date.parse(`${day}T04:00:00.000Z`) + hours * 3_600_000).toISOString(),
  source: 'history',
  downtimeMin: hours * 60,
  repairMin: hours * 60,
  workType: null,
});

const report = ([id, machineId, day, hours, pm]: Entry): ReportRow => ({
  id: `r-${id.slice(-2)}`,
  ticketId: id,
  machineId,
  date: day,
  shift: 'A',
  problem: 'Spindle noise',
  downtimeMin: hours * 60,
  responseMin: null,
  repairMin: hours * 60,
  category: null,
  maintCode: pm ? 'PM' : 'MECH',
  spareUsed: null,
  rootCause: null,
  doneBy: [],
  supportedBy: [],
  correctiveAction: 'Spindle bearing replaced',
  recordedHours: hours,
});

function plant(oemCauses: readonly OemCauseRow[] = [], young = true): EngineData {
  const machines = [
    machine(MACHINE.O1, 'O-1', '2020-01-01'),
    machine(MACHINE.N1, 'N-1', null),
    ...(young
      ? [machine(MACHINE.Y1, 'Y-1', '2026-06-01'), machine(MACHINE.Y2, 'Y-2', '2026-09-01')]
      : []),
  ];
  const kept = new Set(machines.map((m) => m.id));
  const entries = ENTRIES.filter(([, machineId]) => kept.has(machineId));
  return {
    timeZone: 'Asia/Kolkata',
    machines,
    moves: [],
    tickets: entries.map(ticket),
    tasks: [],
    reports: entries.map(report),
    people: [],
    lists: {},
    settings: {
      excludedMachineIds: [],
      problemFixes: {},
      cells: ['Cell 1'],
      locations: ['Shop 1'],
    },
    oemCauses,
  };
}

interface Kpi {
  label: string;
  value: string;
  sub: string;
}
interface Table {
  title: string;
  header: string[];
  rows: string[][];
  rowTicketIds?: string[];
}
interface Page {
  page: string;
  title: string;
  kpis: Kpi[];
  tables: Table[];
}

const MACHINES = 'Machines';
const EVERY = 'Every breakdown on a young machine: decide the cause';

function run(data: EngineData): { page: Page; drillIds: readonly string[] } {
  const computed = oemAnalyticsFigure({ data, asOf: AS_OF, profile: DEFAULT_PROFILE });
  const page = (computed.value as unknown as { pages: Page[] }).pages[0]!;
  return { page, drillIds: computed.drillIds };
}
const kpi = (page: Page, label: string): Kpi => page.kpis.find((k) => k.label === label)!;
const tableOf = (page: Page, title: string): Table => page.tables.find((t) => t.title === title)!;
const mainCause = (page: Page, code: string): string | undefined =>
  tableOf(page, MACHINES).rows.find((row) => row[0] === code)?.[10];
/** The Cause column of each breakdown row, keyed by its ticket. */
function causes(page: Page): Record<string, string> {
  const every = tableOf(page, EVERY);
  return Object.fromEntries(every.rows.map((row, i) => [every.rowTicketIds![i]!, row[6]!]));
}

describe('OEM Analytics hidden edges', () => {
  it('no stored cause: every breakdown and machine reads Not decided, the cause KPIs read zero', () => {
    const { page } = run(plant());
    expect(kpi(page, 'OEM or commissioning').value).toBe('0.0 hrs');
    expect(kpi(page, 'Our side').value).toBe('0.0 hrs');
    expect(mainCause(page, 'Y-1')).toBe('Not decided');
    expect(Object.values(causes(page))).toEqual(['Not decided', 'Not decided', 'Not decided']);
  });

  it('a stored cause moves hours into OEM or commissioning and changes the Main cause', () => {
    const { page } = run(plant([{ ticketId: TICKET.A, cause: 'oem' }]));
    expect(kpi(page, 'OEM or commissioning')).toMatchObject({
      value: '4.0 hrs',
      sub: '57% of the hours',
    });
    expect(kpi(page, 'Downtime').sub).toBe('43% of the hours not decided yet');
    expect(mainCause(page, 'Y-1')).toBe('OEM / build defect');
    expect(causes(page)[TICKET.A]).toBe('OEM / build defect');
    expect(causes(page)[TICKET.B]).toBe('Not decided');
    expect(kpi(page, 'Inside warranty').sub).toBe('1 causes decided by people, 2 not decided');
  });

  it('install counts as OEM or commissioning and ours as Our side', () => {
    const { page } = run(
      plant([
        { ticketId: TICKET.A, cause: 'oem' },
        { ticketId: TICKET.B, cause: 'install' },
        { ticketId: TICKET.C, cause: 'ours' },
      ]),
    );
    expect(kpi(page, 'OEM or commissioning').value).toBe('6.0 hrs');
    expect(kpi(page, 'Our side')).toMatchObject({ value: '1.0 hrs', sub: '14% of the hours' });
    expect(mainCause(page, 'Y-2')).toBe('Our side');
    expect(causes(page)[TICKET.B]).toBe('Installation / commissioning');
  });

  it('an undecided row reads Not decided', () => {
    const { page } = run(plant([{ ticketId: TICKET.A, cause: 'undecided' }]));
    expect(kpi(page, 'OEM or commissioning').value).toBe('0.0 hrs');
    expect(mainCause(page, 'Y-1')).toBe('Not decided');
    expect(causes(page)[TICKET.A]).toBe('Not decided');
  });

  it('prints no rupee and no UUID anywhere a person reads', () => {
    const { page } = run(plant([{ ticketId: TICKET.A, cause: 'oem' }]));
    expect(JSON.stringify(page)).not.toMatch(/₹|\bRs\b|rupee|lakh/i);
    const printed = [
      ...page.kpis.flatMap((k) => [k.label, k.value, k.sub]),
      ...page.tables.flatMap((t) => [t.title, ...t.header, ...t.rows.flat()]),
    ];
    expect(printed.filter((text) => UUID.test(text))).toEqual([]);
  });

  it('no young machine gives a null value and no drill', () => {
    expect(
      oemAnalyticsFigure({ data: plant([], false), asOf: AS_OF, profile: DEFAULT_PROFILE }),
    ).toEqual({
      value: null,
      drillIds: [],
    });
  });

  it('the breakdown table names one ticket per row, newest first; the drill is the young breakdowns', () => {
    const { page, drillIds } = run(plant());
    const every = tableOf(page, EVERY);
    expect(every.rowTicketIds).toHaveLength(every.rows.length);
    expect(every.rowTicketIds).toEqual([TICKET.C, TICKET.B, TICKET.A]);
    expect([...drillIds].sort()).toEqual([TICKET.A, TICKET.B, TICKET.C].sort());
  });

  it('leaves out machines with no purchase date and PM reports', () => {
    const { page, drillIds } = run(plant());
    expect(kpi(page, 'Young machines')).toEqual({
      label: 'Young machines',
      value: '2',
      sub: 'under 300 days, 1 older machines used as the comparison',
    });
    expect(kpi(page, 'Breakdowns').value).toBe('3');
    expect(kpi(page, 'Downtime').value).toBe('7.0 hrs');
    expect(tableOf(page, MACHINES).rows.map((row) => row[0])).toEqual(['Y-1', 'Y-2']);
    expect(drillIds).not.toContain(TICKET.PM);
    expect(drillIds).not.toContain(TICKET.N);
  });
});
