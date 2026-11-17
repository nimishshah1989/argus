import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import {
  runWith,
  type EngineData,
  type EngineResult,
  type FigureResult,
  type MachineRow,
} from '../src/index.js';
import { dashboardComputers } from '../src/analytics/computers.js';
import { DASHBOARD, ENGINE_DATA, kpiByLabel, type DashboardKpi } from './answer-key/fixture.js';

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

const ELEVEN = [...MACHINE_COUNTS, ...DERIVED] as const;

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
  metadata: {},
};

describe('the eleven dashboard figures on the 11 November workbook', () => {
  const result = run();
  const machineIds = new Set(ENGINE_DATA.machines.map((machine) => machine.id));
  const ticketIds = new Set(
    [...ENGINE_DATA.tickets, ...ENGINE_DATA.tasks].map((ticket) => ticket.id),
  );

  it("answers each of the eleven with the answer key's exact number, as the platform showed it", () => {
    expect(DASHBOARD.asOf).toBe(AS_OF);
    for (const [key, label] of ELEVEN) {
      const answer = kpiByLabel(label);
      expect(figure(result, key).status, key).toBe('ready');
      expect(figure(result, key).value, `${label}: ours vs key`).toBe(keyNumber(answer));
    }
  });

  it("parses a count exactly and an hours figure to the key's own decimals, never rounding a unit away", () => {
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
