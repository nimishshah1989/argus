import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, DRILL_TYPES } from '@uptimo/shared';
import {
  COMPUTERS,
  FIGURES,
  FIGURE_KEYS,
  dataAsOf,
  plantDay,
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
  excludedFromProduction: false,
  metadata: {},
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
  timeZone: 'Asia/Kolkata',
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
      expect(figure.owner, figure.key).toBeLessThanOrEqual(67);
    }
  });

  it('names the money figures one by one: a mixed screen keeps its other numbers under its own key', () => {
    expect(FIGURES.filter((figure) => figure.money).map((figure) => figure.key)).toEqual([
      'compare.spares-cost',
      'team-focus.cost',
      'money-matters',
      'action-center.spares-spend',
    ]);
  });

  it('has a registered figure for every computation', () => {
    for (const key of Object.keys(COMPUTERS)) expect(FIGURE_KEYS, key).toContain(key);
  });

  it('covers a screen of every engine ticket from 38 to 45, 48, 50 and 67', () => {
    const owners = new Set(FIGURES.map((figure) => figure.owner));
    expect([...owners].sort()).toEqual([38, 39, 40, 41, 42, 43, 44, 45, 48, 50, 67]);
  });
});

describe('run(data, asOf, profile)', () => {
  it('answers every registered figure, each with its drill type, and says which are not computed yet', () => {
    const result = run(DATA, '2026-11-11', DEFAULT_PROFILE);
    expect(result.figures.map((figure) => figure.key)).toEqual(FIGURE_KEYS);
    // A figure with a computer is computed; one with no computer is honestly not_computed and drills nowhere.
    // Comparing the two lists proves neither a computation nor a "not computed yet" claim has gone missing.
    const computed = Object.keys(COMPUTERS).sort();
    const ready = result.figures
      .filter((figure) => figure.status === 'ready')
      .map((figure) => figure.key)
      .sort();
    expect(ready).toEqual(computed);
    expect(
      result.figures
        .filter((figure) => figure.status === 'not_computed')
        .map((figure) => figure.key),
    ).toEqual(FIGURE_KEYS.filter((key) => !computed.includes(key)));
    for (const figure of result.figures) {
      expect(DRILL_TYPES, figure.key).toContain(figure.drill.type);
      if (computed.includes(figure.key)) {
        expect(figure.status, figure.key).toBe('ready');
      } else {
        expect(figure.status, figure.key).toBe('not_computed');
        expect(figure.drill.ids, figure.key).toEqual([]);
      }
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
    const profile = { ...DEFAULT_PROFILE, mmThroughput: 2500 };
    const seen: unknown[] = [];
    const result = runWith(
      {
        'dashboard.total-machines': ({ data, asOf, profile: p }) => {
          seen.push([asOf, p.mmThroughput]);
          return { value: data.machines.length, drillIds: data.machines.map((m) => m.id) };
        },
      },
      { data: DATA, asOf: '2026-11-11', profile },
    );
    expect(seen).toEqual([['2026-11-11', 2500]]);
    expect(result.profile.mmThroughput).toBe(2500);
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

  it('refuses a computed figure that has a value but names no rows, and allows an empty one', () => {
    const run1 = (value: number) =>
      runWith(
        { 'dashboard.total-breakdowns': () => ({ value, drillIds: [] }) },
        { data: DATA, asOf: '2026-11-11', profile: DEFAULT_PROFILE },
      );
    expect(() => run1(7)).toThrow(/names no rows/);
    expect(run1(0).figures.find((f) => f.key === 'dashboard.total-breakdowns')?.status).toBe(
      'ready',
    );
  });

  it('refuses a date that is not a plant date', () => {
    expect(() => run(DATA, '11-11-2026', DEFAULT_PROFILE)).toThrow(RangeError);
  });
});

describe('plant dates', () => {
  it('puts 01:00 IST on 1 November on 1 November, though it is stored on 31 October', () => {
    expect(plantDay('2026-10-31T19:30:00.000Z', 'Asia/Kolkata')).toBe('2026-11-01');
    expect(plantDay('2026-10-31T19:30:00.000Z', 'UTC')).toBe('2026-10-31');
    expect(plantDay('2026-11-01T18:29:00.000Z', 'Asia/Kolkata')).toBe('2026-11-01');
    expect(plantDay('2026-11-01T18:30:00.000Z', 'Asia/Kolkata')).toBe('2026-11-02');
  });

  it('cuts the plant at the end of asOf in plant time: a breakdown after plant midnight is not in the day before', () => {
    const late = {
      ...ticket('late', 'm1'),
      reportedAt: '2026-10-31T19:30:00.000Z',
      closedAt: null,
      status: 'open' as const,
    };
    const data: EngineData = { ...DATA, tickets: [late] };
    expect(run(data, '2026-10-31', DEFAULT_PROFILE).rows.tickets).toBe(0);
    expect(run(data, '2026-11-01', DEFAULT_PROFILE).rows.tickets).toBe(1);
  });

  it('shows a ticket closed later as still open, without its downtime or report, and cuts moves and new machines', () => {
    const closedLater = {
      ...ticket('t9', 'm1'),
      reportedAt: '2026-11-02T04:00:00.000Z',
      closedAt: '2026-11-04T10:00:00.000Z',
    };
    const report = {
      id: 'r9',
      ticketId: 't9',
      machineId: 'm1',
      date: '2026-11-02',
      shift: '1',
      problem: 'x',
      downtimeMin: 60,
      responseMin: null,
      repairMin: null,
      category: null,
      maintCode: null,
      spareUsed: null,
      rootCause: null,
      doneBy: [],
      supportedBy: [],
    };
    const data: EngineData = {
      ...DATA,
      machines: [machine('m1', 'TC-1'), { ...machine('m3', 'TC-3'), purchasedOn: '2026-11-04' }],
      moves: [
        { id: 'mv1', machineId: 'm1', fromCell: '1', toCell: '2', effectiveFrom: '2026-11-05' },
      ],
      tickets: [closedLater],
      reports: [report],
    };
    const early = dataAsOf(data, '2026-11-03');
    expect(early.machines.map((m) => m.code)).toEqual(['TC-1']);
    expect(early.moves).toEqual([]);
    expect(early.reports).toEqual([]);
    expect(early.tickets[0]).toMatchObject({ status: 'open', closedAt: null, downtimeMin: null });
    const later = dataAsOf(data, '2026-11-05');
    expect(later.machines).toHaveLength(2);
    expect(later.moves).toHaveLength(1);
    expect(later.reports).toHaveLength(1);
    expect(later.tickets[0]).toMatchObject({ status: 'closed', downtimeMin: 120 });
  });

  it('drops a report whose ticket was cut away, so every report names a ticket row of the snapshot', () => {
    const late = {
      ...ticket('t1', 'm1'),
      reportedAt: '2026-11-16T04:00:00.000Z',
      closedAt: '2026-11-16T06:00:00.000Z',
    };
    const report = {
      id: 'r1',
      ticketId: 't1',
      machineId: 'm1',
      date: '2026-11-01',
      shift: '1',
      problem: 'x',
      downtimeMin: 60,
      responseMin: null,
      repairMin: null,
      category: null,
      maintCode: null,
      spareUsed: null,
      rootCause: null,
      doneBy: [],
      supportedBy: [],
    };
    const data: EngineData = { ...DATA, tickets: [late], reports: [report] };
    const early = dataAsOf(data, '2026-11-01');
    expect(early.tickets).toEqual([]);
    expect(early.reports).toEqual([]);
  });
});

/** The engine reads no clock, no random number and no machine time zone: any such call is a finding. */
const BANNED = [
  [/\bDate\.now\s*\(/, 'Date.now()'],
  [/\bnew Date\s*\(\s*\)/, 'new Date()'],
  [/\bnew Date\s*\(\s*\d/, 'a local-time constructor'],
  [/\bDate\.parse\s*\(/, 'Date.parse()'],
  [/\bMath\.random\s*\(/, 'Math.random()'],
  [/\.get(?:Date|Day|Hours|Minutes|Month|FullYear)\s*\(/, 'a local-time getter'],
  [/toLocale\w*String\s*\([^)]*\)/, 'a locale formatter without a time zone'],
] as const;

function clockProblems(source: string): string[] {
  const found: string[] = [];
  for (const [pattern, name] of BANNED) {
    const hits = source.match(new RegExp(pattern, 'g')) ?? [];
    for (const hit of hits) {
      if (name === 'a locale formatter without a time zone' && /timeZone/.test(hit)) continue;
      found.push(name);
    }
  }
  return found;
}

describe('a deterministic engine', () => {
  const dir = new URL('../src/analytics/', import.meta.url);
  const files = readdirSync(dir).filter((name) => name.endsWith('.ts'));

  it.each(files)('%s reads no clock, random number or machine time zone', (name) => {
    expect(clockProblems(readFileSync(new URL(name, dir), 'utf8')), name).toEqual([]);
  });

  it('catches a computation that would use the clock', () => {
    const bad = 'export const c = () => ({ value: Date.now(), drillIds: [] });';
    expect(clockProblems(bad)).toEqual(['Date.now()']);
    expect(clockProblems('const d = new Date(); const r = Math.random(); x.getHours();')).toEqual([
      'new Date()',
      'Math.random()',
      'a local-time getter',
    ]);
  });

  it('catches a date built from local parts and Date.parse, the two ways a machine time zone slips in', () => {
    expect(
      clockProblems('const d = new Date(2026, 10, 1); const p = Date.parse("2026-11-01");'),
    ).toEqual(['a local-time constructor', 'Date.parse()']);
  });
});
