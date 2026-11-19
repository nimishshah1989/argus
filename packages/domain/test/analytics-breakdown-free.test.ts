import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import {
  run,
  type EngineData,
  type MachineRow,
  type ReportRow,
  type TicketRow,
} from '../src/index.js';

/**
 * "Breakdown-free machines" when no machine is: the honest answer is "0 of N", and it must not take the rest of
 * the plant's figures down with it. A plant whose every CNC machine broke down this month is a real plant.
 */

const machine = (id: string): MachineRow => ({
  id,
  code: id.toUpperCase(),
  segment: 'CNC',
  category: 'Turning Center',
  cell: '1',
  location: null,
  make: null,
  model: null,
  controller: null,
  year: 2020,
  purchasedOn: null,
  powerKw: null,
  capacityKva: null,
  assetCode: null,
  status: 'active',
  criticality: null,
  excludedFromProduction: false,
  metadata: {},
});

const ticket = (machineId: string): TicketRow => ({
  id: `t-${machineId}`,
  ref: `BD-${machineId}`,
  kind: 'stopped',
  status: 'closed',
  machineId,
  reportedAt: '2026-12-20T04:00:00.000Z',
  closedAt: '2026-12-20T06:00:00.000Z',
  source: 'history',
  downtimeMin: 120,
  repairMin: 90,
  workType: null,
});

const report = (machineId: string): ReportRow => ({
  id: `r-${machineId}`,
  ticketId: `t-${machineId}`,
  machineId,
  date: '2026-12-20',
  shift: 'A',
  problem: 'Spindle alarm',
  downtimeMin: 120,
  responseMin: 10,
  repairMin: 90,
  category: null,
  maintCode: null,
  spareUsed: null,
  rootCause: null,
  doneBy: [],
  supportedBy: [],
});

const ids = ['m1', 'm2', 'm3', 'm4'];
const data = (machines: string[], broken: string[]): EngineData => ({
  timeZone: 'Asia/Kolkata',
  machines: machines.map(machine),
  moves: [],
  tickets: broken.map(ticket),
  tasks: [],
  reports: broken.map(report),
  people: [],
  lists: {},
});

const freeOf = (input: EngineData) =>
  run(input, '2026-12-31', DEFAULT_PROFILE).figures.find(
    (f) => f.key === 'dashboard.breakdown-free',
  );

describe('breakdown-free machines on a plant where every machine broke down this month', () => {
  it('answers "0 of 4" with nothing to open, and the rest of the plant still computes', () => {
    const result = run(data(ids, ids), '2026-12-31', DEFAULT_PROFILE);
    const free = result.figures.find((f) => f.key === 'dashboard.breakdown-free');
    expect(free?.status).toBe('ready');
    expect(free?.value).toEqual({ runningClean: 0, inService: 4 });
    expect(free?.drill).toEqual({ type: 'machine', ids: [] });
    expect(result.figures.find((f) => f.key === 'dashboard.total-machines')?.status).toBe('ready');
  });

  it('still opens exactly the clean machines when some are clean', () => {
    const free = freeOf(data(ids, ['m1', 'm2']));
    expect(free?.value).toEqual({ runningClean: 2, inService: 4 });
    expect(free?.drill.ids).toEqual(['m3', 'm4']);
  });
});
