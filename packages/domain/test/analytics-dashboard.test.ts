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
import { DASHBOARD, ENGINE_DATA, kpiByLabel } from './answer-key/fixture.js';

/**
 * The six machine counts of the Dashboard against the 11 November platform (answer key), computed from
 * `input.json` with no database and no clock. The definitions are the key's own sub-labels: the fleet total is
 * CNC + Conventional + Process, utilities and DG stand outside the load, and each figure names the machines it
 * counted so a drill can open them.
 */

const AS_OF = '2026-11-11';

/** The figure key and the platform's own KPI label, nothing looser. */
const SIX = [
  ['dashboard.total-machines', 'Total Machines'],
  ['dashboard.utilities', 'Utilities'],
  ['dashboard.dg-sets', 'DG Sets'],
  ['dashboard.cnc-machines', 'CNC Machines'],
  ['dashboard.conventional-machines', 'Conventional Machines'],
  ['dashboard.process-machines', 'Process Machines'],
] as const;

const run = (data: EngineData = ENGINE_DATA): EngineResult =>
  runWith(dashboardComputers, { data, asOf: AS_OF, profile: DEFAULT_PROFILE });

function figure(result: EngineResult, key: string): FigureResult {
  const found = result.figures.find((candidate) => candidate.key === key);
  if (!found) throw new Error(`no figure ${key}`);
  return found;
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

describe('the six machine counts on the 11 November workbook', () => {
  const result = run();
  const machineIds = new Set(ENGINE_DATA.machines.map((machine) => machine.id));

  it("answers each of the six with the answer key's number, as the platform showed it", () => {
    expect(DASHBOARD.asOf).toBe(AS_OF);
    for (const [key, label] of SIX) {
      const answer = kpiByLabel(label);
      // A machine count is a bare integer in the key, so this parses it exactly and never rounds a unit away.
      expect(answer.value, label).toMatch(/^\d+$/);
      expect(figure(result, key).status, key).toBe('ready');
      expect(figure(result, key).value, `${label}: ours vs key`).toBe(Number(answer.value));
    }
  });

  it('names every counted machine and no machine the data does not hold', () => {
    for (const [key] of SIX) {
      const counted = figure(result, key);
      expect(counted.drill.type, key).toBe('machine');
      expect(counted.drill.ids.length, key).toBe(counted.value);
      for (const id of counted.drill.ids) {
        expect(machineIds.has(id), `${key} drills to ${id}`).toBe(true);
      }
    }
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
