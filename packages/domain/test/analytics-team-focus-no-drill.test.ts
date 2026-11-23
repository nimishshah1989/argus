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
 * Issue #558: Team Focus's "data|multi" action counts machine and problem pairs logged four or more times; it names
 * no machine, so the figure can have a value and no drill rows. That must not take the plant's figures down.
 * Mirrors the seed of apps/server/test/analytics-money-rights.test.ts, where it made every figures read a 500.
 */

const machine: MachineRow = {
  id: 'm1',
  code: 'M1',
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
};

const ticket = (n: number): TicketRow => ({
  id: `t${n}`,
  ref: `BD-${n}`,
  kind: 'stopped',
  status: 'closed',
  machineId: 'm1',
  reportedAt: '2026-12-15T02:30:00.000Z',
  closedAt: '2026-12-15T02:30:00.000Z',
  source: 'history',
  downtimeMin: 30,
  repairMin: 20,
  workType: null,
});

const report = (n: number): ReportRow => ({
  id: `r${n}`,
  ticketId: `t${n}`,
  machineId: 'm1',
  date: '2026-12-15',
  shift: 'A',
  problem: 'Breakdown',
  downtimeMin: 30,
  responseMin: 10,
  repairMin: 20,
  category: null,
  maintCode: 'BRG',
  spareUsed: 'Bearing',
  spareCost: 5000,
  rootCause: null,
  doneBy: [],
  supportedBy: [],
});

const four = [1, 2, 3, 4];
const data: EngineData = {
  timeZone: 'Asia/Kolkata',
  machines: [machine],
  moves: [],
  tickets: four.map(ticket),
  tasks: [],
  reports: four.map(report),
  people: [],
  lists: {},
};

describe('Team Focus on a plant whose only breakdowns are four logs today of one machine and problem', () => {
  it('computes every figure, Team Focus included, without throwing', () => {
    const result = run(data, '2026-12-15', DEFAULT_PROFILE);
    expect(result.figures.find((f) => f.key === 'team-focus')).toBeDefined();
  });
});
