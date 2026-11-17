import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import {
  runWith,
  type EngineData,
  type EngineResult,
  type FigureResult,
  type MachineRow,
  type ReportRow,
  type TicketRow,
} from '../src/index.js';
import { dashboardComputers } from '../src/analytics/computers.js';
import {
  CHECKLIST,
  DASHBOARD,
  ENGINE_DATA,
  chartById,
  kpiByLabel,
  type DashboardKpi,
} from './answer-key/fixture.js';

/**
 * Every Dashboard figure the engine computes, against the 11 November platform (answer key), from `input.json`
 * with no database and no clock. The definitions are the key's own sub-labels: the fleet total is CNC +
 * Conventional + Process, utilities and DG stand outside the load, downtime is actual breakdowns (NO-DT rows are
 * their own number), and the average divides by the CNC machines. Each figure names the rows it counted so a
 * drill opens them.
 */

const AS_OF = '2026-11-11';

/** The six machine counts of packet 38.0 and the platform's own KPI labels, nothing looser. */
const MACHINE_COUNTS = [
  ['dashboard.total-machines', 'Total Machines'],
  ['dashboard.utilities', 'Utilities'],
  ['dashboard.dg-sets', 'DG Sets'],
  ['dashboard.cnc-machines', 'CNC Machines'],
  ['dashboard.conventional-machines', 'Conventional Machines'],
  ['dashboard.process-machines', 'Process Machines'],
] as const;

/** The five numbers of packet 38.1: the key's own labels, each a ticket-drilled figure. */
const DERIVED = [
  ['dashboard.total-breakdowns', 'Total Breakdowns'],
  ['dashboard.total-downtime-hours', 'Total Downtime'],
  ['dashboard.pm-hours', 'PM Hours'],
  ['dashboard.no-downtime-hours', 'BD Hours but NO Downtime'],
  ['dashboard.avg-bd-hours-per-machine', 'Avg BD Hours / Machine'],
] as const;

/** The four of packet 38.4, whose formulas the platform's own Guide states (available hours, the record span). */
const GUIDE_FORMULAS = [
  ['dashboard.fleet-availability', 'Fleet Availability'],
  ['dashboard.plant-bd-pct', 'Plant BD %'],
  ['dashboard.avg-complaints-per-day', 'Avg Complaints / Day'],
  ['dashboard.avg-bd-hours-per-day', 'Avg BD Hours / Day'],
] as const;

const ELEVEN = [...MACHINE_COUNTS, ...DERIVED] as const;
const FIFTEEN = [...ELEVEN, ...GUIDE_FORMULAS] as const;

const run = (data: EngineData = ENGINE_DATA): EngineResult =>
  runWith(dashboardComputers, { data, asOf: AS_OF, profile: DEFAULT_PROFILE });

function figure(result: EngineResult, key: string): FigureResult {
  const found = result.figures.find((candidate) => candidate.key === key);
  if (!found) throw new Error(`no figure ${key}`);
  return found;
}

/**
 * The key prints a figure as text with its unit ("1,279", "3,060.1 hrs", "24.29 hrs"). This takes the exact
 * number it showed: no tolerance, no re-rounding the key to fit a computation.
 */
function keyNumber(kpi: DashboardKpi): number {
  const raw = kpi.value.replace(/,/g, '').replace(/\s*(?:hrs|%)$/, '');
  const value = Number(raw);
  if (raw === '' || !Number.isFinite(value)) {
    throw new Error(`the answer key's ${kpi.label} is not a number: "${kpi.value}"`);
  }
  return value;
}

/** A machine the workbook does not hold: the negative control for a count that must read the data it is given. */
const extraMachine: MachineRow = {
  id: 'TEST-NEW-1',
  code: 'TEST-NEW-1',
  segment: 'CNC',
  category: 'Turning Center',
  cell: '1',
  location: null,
  make: null,
  model: null,
  controller: null,
  year: 2026,
  purchasedOn: null,
  powerKw: null,
  capacityKva: null,
  assetCode: null,
  status: 'active',
  criticality: null,
  excludedFromProduction: false,
  metadata: {},
};

describe('the fifteen dashboard figures on the 11 November workbook', () => {
  const result = run();
  const machineIds = new Set(ENGINE_DATA.machines.map((machine) => machine.id));
  const ticketIds = new Set(
    [...ENGINE_DATA.tickets, ...ENGINE_DATA.tasks].map((ticket) => ticket.id),
  );

  it("answers each of the fifteen with the answer key's exact number, as the platform showed it", () => {
    expect(DASHBOARD.asOf).toBe(AS_OF);
    for (const [key, label] of FIFTEEN) {
      const answer = kpiByLabel(label);
      expect(figure(result, key).status, key).toBe('ready');
      expect(figure(result, key).value, `${label}: ours vs key`).toBe(keyNumber(answer));
    }
  });

  it("parses a count exactly, an hours figure to the key's decimals and the percentages as points", () => {
    for (const [, label] of MACHINE_COUNTS) expect(kpiByLabel(label).value, label).toMatch(/^\d+$/);
    expect(kpiByLabel('Total Breakdowns').value).toMatch(/^\d+$/);
    for (const label of [
      'Total Downtime',
      'PM Hours',
      'BD Hours but NO Downtime',
      'Avg BD Hours / Machine',
    ]) {
      expect(kpiByLabel(label).value, label).toMatch(/^[\d,]+(?:\.\d+)? hrs$/);
    }
    for (const label of ['Fleet Availability', 'Plant BD %']) {
      expect(kpiByLabel(label).value, label).toMatch(/^\d+\.\d{2}%$/);
    }
    for (const label of ['Avg Complaints / Day', 'Avg BD Hours / Day']) {
      expect(kpiByLabel(label).value, label).toMatch(/^\d+\.\d{2}$/);
    }
  });

  it('names every counted machine and no machine the data does not hold', () => {
    for (const [key] of MACHINE_COUNTS) {
      const counted = figure(result, key);
      expect(counted.drill.type, key).toBe('machine');
      expect(counted.drill.ids.length, key).toBe(counted.value);
      for (const id of counted.drill.ids) {
        expect(machineIds.has(id), `${key} drills to ${id}`).toBe(true);
      }
    }
  });

  it('drills the five derived numbers to the tickets they counted, never to another row', () => {
    for (const [key] of DERIVED) {
      const figureRow = figure(result, key);
      expect(figureRow.drill.type, key).toBe('ticket');
      expect(figureRow.drill.ids.length, key).toBeGreaterThan(0);
      for (const id of figureRow.drill.ids) {
        expect(ticketIds.has(id), `${key} drills to ${id}`).toBe(true);
      }
    }
    const breakdowns = figure(result, 'dashboard.total-breakdowns');
    expect(breakdowns.drill.ids.length).toBe(breakdowns.value);
    // The average is the same downtime rows divided by the same plant, so it drills to the same tickets.
    expect(figure(result, 'dashboard.avg-bd-hours-per-machine').drill.ids).toEqual(
      figure(result, 'dashboard.total-downtime-hours').drill.ids,
    );
  });

  it('divides the average by the CNC machines the key names, not by the whole fleet', () => {
    const downtime = Number(figure(result, 'dashboard.total-downtime-hours').value);
    const cnc = Number(figure(result, 'dashboard.cnc-machines').value);
    expect(figure(result, 'dashboard.avg-bd-hours-per-machine').value).toBe(
      Math.round((downtime / cnc) * 100) / 100,
    );
  });

  it('drills the four Guide figures to the rows their formulas read: production machines and tickets', () => {
    const availability = figure(result, 'dashboard.fleet-availability');
    const production = ENGINE_DATA.machines.filter(
      (machine) => machine.segment === 'CNC' && !machine.excludedFromProduction,
    );
    expect(availability.drill.type).toBe('machine');
    expect(availability.drill.ids).toEqual(production.map((machine) => machine.id).sort());
    for (const id of availability.drill.ids) expect(machineIds.has(id), id).toBe(true);
    const excluded = ENGINE_DATA.machines
      .filter((machine) => machine.excludedFromProduction)
      .map((machine) => machine.id);
    expect(excluded.length).toBeGreaterThan(0);
    for (const id of excluded) expect(availability.drill.ids, id).not.toContain(id);

    // Both daily averages are the key's own totals over the record span, so they drill to those same tickets.
    expect(figure(result, 'dashboard.avg-complaints-per-day').drill).toEqual(
      figure(result, 'dashboard.total-breakdowns').drill,
    );
    expect(figure(result, 'dashboard.avg-bd-hours-per-day').drill).toEqual(
      figure(result, 'dashboard.total-downtime-hours').drill,
    );
    const bdPct = figure(result, 'dashboard.plant-bd-pct');
    expect(bdPct.drill.type).toBe('ticket');
    expect(bdPct.drill.ids.length).toBeGreaterThan(0);
    for (const id of bdPct.drill.ids) expect(ticketIds.has(id), id).toBe(true);
  });

  it('divides both daily averages by the span the breakdown log covers, first to last day included', () => {
    const dates = ENGINE_DATA.reports
      .filter((report) => report.maintCode !== 'PM')
      .map((report) => report.date)
      .sort();
    const first = dates[0] ?? '';
    const last = dates[dates.length - 1] ?? '';
    const days =
      (Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000 + 1;
    expect(days).toBe(311);
    const toTwo = (value: number) => Math.round(value * 100) / 100;
    expect(figure(result, 'dashboard.avg-complaints-per-day').value).toBe(
      toTwo(Number(figure(result, 'dashboard.total-breakdowns').value) / days),
    );
    expect(figure(result, 'dashboard.avg-bd-hours-per-day').value).toBe(
      toTwo(Number(figure(result, 'dashboard.total-downtime-hours').value) / days),
    );
  });

  it("splits the fleet as the key's sub-labels say: utilities and DG stand outside the total", () => {
    const count = (key: string) => Number(figure(result, key).value);
    const total = figure(result, 'dashboard.total-machines');
    const split =
      count('dashboard.cnc-machines') +
      count('dashboard.conventional-machines') +
      count('dashboard.process-machines');
    expect(total.value).toBe(split);
    const outside = [
      ...figure(result, 'dashboard.utilities').drill.ids,
      ...figure(result, 'dashboard.dg-sets').drill.ids,
    ];
    for (const id of outside) expect(total.drill.ids, id).not.toContain(id);
  });
});

describe('a machine count reads the data it is given', () => {
  it('counts an added machine and re-drills, so the figure is not a constant', () => {
    const before = figure(run(), 'dashboard.total-machines');
    const after = figure(
      run({ ...ENGINE_DATA, machines: [...ENGINE_DATA.machines, extraMachine] }),
      'dashboard.total-machines',
    );
    expect(after.value).toBe(Number(before.value) + 1);
    expect(after.drill.ids).toContain(extraMachine.id);
    expect(before.drill.ids).not.toContain(extraMachine.id);
    expect(after.drill.ids.length).toBe(after.value);
  });
});

describe('a machine excluded from production data', () => {
  const excludedMachine: MachineRow = {
    ...extraMachine,
    id: 'TEST-EXCLUDED-1',
    code: 'TEST-EXCLUDED-1',
    excludedFromProduction: true,
  };
  const productionMachine: MachineRow = {
    ...extraMachine,
    id: 'TEST-PRODUCTION-1',
    code: 'TEST-PRODUCTION-1',
  };

  /**
   * A breakdown row for the excluded Robot, which the workbook itself holds no row for: one real, sourced row with
   * downtime, dated inside the record span, so only the production filter can keep it out of the Guide figures.
   */
  const robot = ENGINE_DATA.machines.find((machine) => machine.id === 'BOXY');
  if (!robot || !robot.excludedFromProduction) {
    throw new Error('the workbook no longer holds the excluded BOXY robot');
  }
  const robotBreakdown = 'TEST-EXCLUDED-BD-1';
  const robotTicket: TicketRow = {
    id: robotBreakdown,
    ref: robotBreakdown,
    kind: 'stopped',
    status: 'closed',
    machineId: robot.id,
    reportedAt: '2026-06-15T02:30:00.000Z',
    closedAt: '2026-06-15T10:30:00.000Z',
    source: 'history',
    downtimeMin: 480,
    repairMin: 450,
    workType: 'AX',
  };
  const robotReport: ReportRow = {
    id: robotBreakdown,
    ticketId: robotBreakdown,
    machineId: robot.id,
    date: '2026-06-15',
    shift: '1',
    problem: 'Robot stopped',
    downtimeMin: 480,
    responseMin: 30,
    repairMin: 450,
    category: 'M',
    maintCode: 'AX',
    spareUsed: null,
    rootCause: null,
    doneBy: [],
    supportedBy: [],
  };

  it("never moves the production figures with an excluded machine's breakdown rows", () => {
    const before = run();
    const after = run({
      ...ENGINE_DATA,
      tickets: [...ENGINE_DATA.tickets, robotTicket],
      reports: [...ENGINE_DATA.reports, robotReport],
    });
    // S2 inverts the old control: dashboard.total-breakdowns now reads the production filter, so the positive
    // control moves to a figure that still counts every sourced row. The fixture change is still proven not a no-op.
    expect(Number(figure(after, 'dashboard.total-downtime-hours').value)).toBe(
      Number(figure(before, 'dashboard.total-downtime-hours').value) + robotReport.downtimeMin / 60,
    );
    for (const key of [
      'dashboard.total-breakdowns',
      'dashboard.plant-bd-pct',
      'dashboard.fleet-availability',
      'dashboard.avg-complaints-per-day',
      'dashboard.avg-bd-hours-per-day',
    ]) {
      expect(figure(after, key).value, key).toBe(figure(before, key).value);
    }
    // The drills name the rows a figure counted, so no Guide figure names the excluded machine's row.
    expect(figure(after, 'dashboard.plant-bd-pct').drill).toEqual(
      figure(before, 'dashboard.plant-bd-pct').drill,
    );
    expect(figure(after, 'dashboard.plant-bd-pct').drill.ids).not.toContain(robotBreakdown);
    // S2: the breakdown count reads the same production filter, so it names no excluded machine's row either.
    expect(figure(after, 'dashboard.total-breakdowns').drill).toEqual(
      figure(before, 'dashboard.total-breakdowns').drill,
    );
    expect(figure(after, 'dashboard.total-breakdowns').drill.ids).not.toContain(robotBreakdown);
    expect(figure(after, 'dashboard.avg-bd-hours-per-day').drill).toEqual(
      figure(before, 'dashboard.avg-bd-hours-per-day').drill,
    );
    const availability = figure(after, 'dashboard.fleet-availability');
    const production = ENGINE_DATA.machines.filter(
      (machine) => machine.segment === 'CNC' && !machine.excludedFromProduction,
    );
    expect(availability.drill.ids.length).toBe(production.length);
    expect(availability.drill.ids).not.toContain(robot.id);
  });

  it('stays in the fleet totals but adds no available hours and joins no production drill', () => {
    const before = run();
    const after = run({
      ...ENGINE_DATA,
      machines: [...ENGINE_DATA.machines, excludedMachine],
    });
    expect(Number(figure(after, 'dashboard.total-machines').value)).toBe(
      Number(figure(before, 'dashboard.total-machines').value) + 1,
    );
    for (const key of ['dashboard.fleet-availability', 'dashboard.plant-bd-pct']) {
      expect(figure(after, key).value, key).toBe(figure(before, key).value);
    }
    expect(figure(after, 'dashboard.fleet-availability').drill.ids).toEqual(
      figure(before, 'dashboard.fleet-availability').drill.ids,
    );
  });

  it('a production machine joins the available-hours denominator and its drill', () => {
    const before = figure(run(), 'dashboard.fleet-availability');
    const after = figure(
      run({ ...ENGINE_DATA, machines: [...ENGINE_DATA.machines, productionMachine] }),
      'dashboard.fleet-availability',
    );
    expect(after.drill.ids).toContain(productionMachine.id);
    expect(after.drill.ids.length).toBe(before.drill.ids.length + 1);
  });
});

/** The two plotted series and the two cards packet 38.2 adds to the workbook. */
interface BubblePoint {
  id: string;
  x: number;
  y: number;
  r: number;
  mttr: number;
}
interface ChartValue {
  labels?: unknown[];
  datasets: Array<{ label: string; data: unknown[] }>;
}

const dashboard = (): EngineResult => run();

describe('the two Dashboard charts on the 11 November workbook', () => {
  const result = dashboard();
  const machineIds = new Set(ENGINE_DATA.machines.map((machine) => machine.id));

  it('draws one bubble per CNC production machine with a breakdown, exactly as the key plotted it', () => {
    const plotted = figure(result, 'dashboard.bubble-chart');
    expect(plotted.status).toBe('ready');
    expect(plotted.drill.type).toBe('machine');
    const value = plotted.value as unknown as ChartValue;
    expect(value.datasets).toEqual(chartById('ch-dash-bubble').datasets);
    const points = value.datasets[0]!.data as BubblePoint[];
    expect([...plotted.drill.ids].sort()).toEqual(points.map((point) => point.id).sort());
    for (const id of plotted.drill.ids) expect(machineIds.has(id), id).toBe(true);
  });

  it('draws the expansion timeline by purchase year, with the cumulative fleet, exactly as the key plotted it', () => {
    const plotted = figure(result, 'dashboard.expansion-timeline');
    expect(plotted.status).toBe('ready');
    expect(plotted.drill.type).toBe('machine');
    const key = chartById('ch-dash-timeline');
    const value = plotted.value as unknown as ChartValue;
    expect(value.labels).toEqual(key.labels);
    expect(value.datasets).toEqual(key.datasets);
    const fleetTotal = Number(key.datasets.at(-1)!.data.at(-1));
    expect(plotted.drill.ids.length).toBe(fleetTotal);
    for (const id of plotted.drill.ids) expect(machineIds.has(id), id).toBe(true);
  });
});

describe('the two cards packet 38.2 registers', () => {
  const result = dashboard();
  const text = DASHBOARD.pages[0]!.text;
  const machineIds = new Set(ENGINE_DATA.machines.map((machine) => machine.id));
  const ticketIds = new Set(
    [...ENGINE_DATA.tickets, ...ENGINE_DATA.tasks].map((ticket) => ticket.id),
  );

  it('counts the breakdown-free machines out of the production fleet in service, as the key card says', () => {
    const match = /RUNNING CLEAN TODAY (\d+) \/ (\d+)/.exec(text);
    if (!match) throw new Error('the answer key holds no breakdown-free card');
    const free = figure(result, 'dashboard.breakdown-free');
    expect(free.status).toBe('ready');
    expect(free.drill.type).toBe('machine');
    expect(free.value).toEqual({ runningClean: Number(match[1]), inService: Number(match[2]) });
    expect(free.drill.ids.length).toBe(Number(match[1]));
    for (const id of free.drill.ids) expect(machineIds.has(id), id).toBe(true);
  });

  it('ranks the problems costing the most downtime, as the key card prints them', () => {
    const printed = [...text.matchAll(/(\d)([A-Za-z][^\d]*?) (\d+) hrs · ([\d.]+)% · (\d+) BDs/g)];
    const expected = printed.map((row) => ({
      problem: row[2]!.trim(),
      hours: Number(row[3]),
      share: Number(row[4]),
      breakdowns: Number(row[5]),
    }));
    expect(expected.length).toBe(3);
    const ranked = figure(result, 'dashboard.costliest-problems');
    expect(ranked.status).toBe('ready');
    expect(ranked.drill.type).toBe('ticket');
    const value = ranked.value as { rows: unknown[] };
    expect(value.rows).toEqual(expected);
    for (const id of ranked.drill.ids) expect(ticketIds.has(id), id).toBe(true);
  });
});

describe('the data checklist on the 11 November workbook', () => {
  const result = dashboard();
  const ticketIds = new Set(
    [...ENGINE_DATA.tickets, ...ENGINE_DATA.tasks].map((ticket) => ticket.id),
  );

  it("answers every open item and every per-group count the key's checklist holds", () => {
    const checklist = figure(result, 'data-checklist');
    expect(checklist.status).toBe('ready');
    expect(checklist.value).toEqual(CHECKLIST.extra);
    expect(CHECKLIST.asOf).toBe(AS_OF);
  });

  it('drills its breakdown items to tickets, never to a row the data does not hold', () => {
    const checklist = figure(result, 'data-checklist');
    expect(checklist.drill.type).toBe('ticket');
    expect(checklist.drill.ids.length).toBeGreaterThan(0);
    for (const id of checklist.drill.ids) expect(ticketIds.has(id), id).toBe(true);
  });
});
