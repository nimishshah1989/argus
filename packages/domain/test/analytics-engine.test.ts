import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, DRILL_TYPES } from '@uptimo/shared';
import {
  FIGURES,
  FIGURE_KEYS,
  run,
  runWith,
  type EngineData,
  type MachineRow,
  type TicketRow,
} from '../src/index.js';

const machine = (id: string, code: string): MachineRow => ({
  id,
  code,
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
});

const ticket = (id: string, machineId: string): TicketRow => ({
  id,
  ref: `BD-${id}`,
  kind: 'stopped',
  status: 'closed',
  machineId,
  reportedAt: '2026-11-01T04:00:00.000Z',
  closedAt: '2026-11-01T06:00:00.000Z',
  source: 'history',
  downtimeMin: 120,
  repairMin: 90,
  workType: null,
});

const DATA: EngineData = {
  machines: [machine('m1', 'TC-1'), machine('m2', 'TC-2')],
  moves: [],
  tickets: [ticket('t1', 'm1'), ticket('t2', 'm2')],
  tasks: [],
  reports: [],
  people: [],
  lists: {},
};

describe('the figure registry', () => {
  it('registers every figure once, with its owner and a drill target', () => {
    expect(new Set(FIGURE_KEYS).size).toBe(FIGURES.length);
    for (const figure of FIGURES) {
      expect(DRILL_TYPES, figure.key).toContain(figure.drill);
      expect(figure.owner, figure.key).toBeGreaterThanOrEqual(38);
      expect(figure.owner, figure.key).toBeLessThanOrEqual(45);
    }
  });

  it('covers a screen of every engine ticket from 38 to 45', () => {
    const owners = new Set(FIGURES.map((figure) => figure.owner));
    expect([...owners].sort()).toEqual([38, 39, 40, 41, 42, 43, 44, 45]);
  });
});

describe('run(data, asOf, profile)', () => {
  it('answers every registered figure, each with its drill type, and says which are not computed yet', () => {
    const result = run(DATA, '2026-11-11', DEFAULT_PROFILE);
    expect(result.figures.map((figure) => figure.key)).toEqual(FIGURE_KEYS);
    for (const figure of result.figures) {
      expect(DRILL_TYPES, figure.key).toContain(figure.drill.type);
      expect(figure.status, figure.key).toBe('not_computed');
      expect(figure.drill.ids, figure.key).toEqual([]);
    }
    expect(result.rows).toEqual({
      machines: 2,
      moves: 0,
      tickets: 2,
      tasks: 0,
      reports: 0,
      people: 0,
    });
  });

  it('is deterministic: the same data, date and profile give the same answer', () => {
    expect(run(DATA, '2026-11-11', DEFAULT_PROFILE)).toEqual(
      run(DATA, '2026-11-11', DEFAULT_PROFILE),
    );
  });

  it('hands the profile and the date to each computation and returns the profile it used', () => {
    const profile = { ...DEFAULT_PROFILE, costPerHour: 2500 };
    const seen: unknown[] = [];
    const result = runWith(
      {
        'dashboard.total-machines': ({ data, asOf, profile: p }) => {
          seen.push([asOf, p.costPerHour]);
          return { value: data.machines.length, drillIds: data.machines.map((m) => m.id) };
        },
      },
      { data: DATA, asOf: '2026-11-11', profile },
    );
    expect(seen).toEqual([['2026-11-11', 2500]]);
    expect(result.profile.costPerHour).toBe(2500);
    const figure = result.figures.find((f) => f.key === 'dashboard.total-machines');
    expect(figure).toMatchObject({
      status: 'ready',
      value: 2,
      drill: { type: 'machine', ids: ['m1', 'm2'] },
    });
  });

  it('refuses a computed figure that drills to a row it was not given', () => {
    const lost = { 'dashboard.total-breakdowns': () => ({ value: 1, drillIds: ['nowhere'] }) };
    expect(() =>
      runWith(lost, { data: DATA, asOf: '2026-11-11', profile: DEFAULT_PROFILE }),
    ).toThrow(/dashboard\.total-breakdowns drills to nowhere/);
  });

  it('refuses a figure that drills to a row of the wrong kind', () => {
    // a machine id where the figure registered tickets
    const wrong = { 'dashboard.total-breakdowns': () => ({ value: 1, drillIds: ['m1'] }) };
    expect(() =>
      runWith(wrong, { data: DATA, asOf: '2026-11-11', profile: DEFAULT_PROFILE }),
    ).toThrow(/not a ticket row/);
  });

  it('refuses a date that is not a plant date', () => {
    expect(() => run(DATA, '11-11-2026', DEFAULT_PROFILE)).toThrow(RangeError);
  });
});
