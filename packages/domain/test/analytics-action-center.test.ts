import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import {
  ACTION_CENTER_TYPES,
  actionCenterThresholds,
  type ActionCenterNudge,
} from '../src/analytics/action-center-model.js';
import { actionCenterNudges } from '../src/analytics/action-center-rules.js';
import type {
  AmcLine,
  EngineData,
  EngineSettings,
  LegalLine,
  MachineRow,
  ReportRow,
  TicketRow,
  WhyWhyRow,
} from '../src/index.js';
import { ACTION_CENTER, ENGINE_DATA } from './answer-key/fixture.js';

/**
 * The Action Center rule engine (ticket 44, packet 44a). The first test is the frozen 11 November key: the whole
 * 36-nudge list, the 16 type labels and the 26 thresholds, with no tolerance. The second suite is clearly NOT
 * key-pinned — the key has no nudge for cell, spike, good news, human mistakes, shift, team, spares, AMC or legal,
 * so a tiny plant is built here to pin those nine rules and the long rule's saved-Why-Why suppression.
 */

const AS_OF = '2026-11-11';
const DAY_MS = 86_400_000;

/** The plant date `age` days before the run date. */
const dayAt = (age: number): string =>
  new Date(Date.parse(AS_OF + 'T00:00:00Z') - age * DAY_MS).toISOString().slice(0, 10);

function machine(id: string, over: Partial<MachineRow> = {}): MachineRow {
  return {
    id,
    code: id,
    segment: 'CNC',
    category: 'Turning Center',
    cell: '7',
    location: 'A',
    make: 'COSMOS',
    model: 'M',
    controller: null,
    year: null,
    purchasedOn: null,
    powerKw: null,
    capacityKva: null,
    assetCode: null,
    status: 'active',
    criticality: null,
    excludedFromProduction: false,
    metadata: {},
    ...over,
  };
}

interface RowSpec {
  id: string;
  machineId: string;
  age: number;
  hours?: number;
  code?: string;
  shift?: string;
  doneBy?: string[];
  spareCost?: number;
}

function reportOf(spec: RowSpec): ReportRow {
  const hours = spec.hours ?? 1;
  return {
    id: spec.id,
    ticketId: 't-' + spec.id,
    machineId: spec.machineId,
    date: dayAt(spec.age),
    shift: spec.shift ?? '1',
    problem: 'Spindle stopped',
    downtimeMin: Math.round(hours * 60),
    responseMin: null,
    repairMin: null,
    category: null,
    maintCode: spec.code ?? 'E',
    spareUsed: null,
    rootCause: null,
    doneBy: spec.doneBy ?? [],
    supportedBy: [],
    recordedHours: hours,
    spareCost: spec.spareCost ?? 0,
  };
}

function ticketOf(report: ReportRow): TicketRow {
  const reportedAt = report.date + 'T08:00:00+05:30';
  return {
    id: report.ticketId ?? report.id,
    ref: report.id,
    kind: 'stopped',
    status: 'closed',
    machineId: report.machineId,
    reportedAt,
    closedAt: reportedAt,
    source: 'history',
    downtimeMin: report.downtimeMin,
    repairMin: report.repairMin,
    workType: report.maintCode,
  };
}

interface PlantSpec {
  machines: MachineRow[];
  rows: RowSpec[];
  settings?: Partial<EngineSettings>;
  amc?: AmcLine[];
  legal?: LegalLine[];
  whyWhy?: WhyWhyRow[];
}

function plant(spec: PlantSpec): EngineData {
  const reports = spec.rows.map(reportOf);
  return {
    timeZone: 'Asia/Kolkata',
    machines: spec.machines,
    moves: [],
    tickets: reports.map(ticketOf),
    tasks: [],
    reports,
    people: [
      { id: 'p-1', code: 'p-1', displayName: 'Person 51', team: 'maintenance', active: true },
    ],
    lists: {
      maint_code: [
        { code: 'E', label: 'Electronics/Electrical', active: true },
        { code: 'HUM', label: 'Human Mistake', active: true },
        { code: 'ATC', label: 'Automatic Tool Changer', active: true },
      ],
    },
    settings: { excludedMachineIds: [], problemFixes: {}, teamCodes: ['p-1'], ...spec.settings },
    whyWhy: spec.whyWhy ?? [],
    amc: spec.amc,
    legal: spec.legal,
  };
}

const keys = (nudges: readonly ActionCenterNudge[]): string[] => nudges.map((n) => n.key);
const nudgeFor = (nudges: readonly ActionCenterNudge[], key: string): ActionCenterNudge => {
  const found = nudges.find((nudge) => nudge.key === key);
  if (found === undefined) throw new Error('no nudge ' + key + ' in ' + keys(nudges).join(', '));
  return found;
};

describe('the Action Center rule engine on the 11 November key', () => {
  it('reproduces the 36 nudges, the 16 type labels and the 26 thresholds exactly', () => {
    const nudges = actionCenterNudges({
      data: ENGINE_DATA,
      asOf: '2026-11-11',
      profile: DEFAULT_PROFILE,
    });
    expect(nudges).toEqual(ACTION_CENTER.extra.nudges);
    expect(ACTION_CENTER_TYPES).toEqual(ACTION_CENTER.extra.types);
    expect(actionCenterThresholds(DEFAULT_PROFILE)).toEqual(ACTION_CENTER.extra.thresholds);
  });

  it('fires the key eight rule families, 29 distinct machines and no extension nudge', () => {
    const nudges = actionCenterNudges({
      data: ENGINE_DATA,
      asOf: '2026-11-11',
      profile: DEFAULT_PROFILE,
    });
    const rules = nudges.reduce<Record<string, number>>((counts, nudge) => {
      counts[nudge.rule] = (counts[nudge.rule] ?? 0) + 1;
      return counts;
    }, {});
    expect(rules).toEqual({
      freq: 14,
      mttr: 7,
      rise: 6,
      newm: 4,
      long: 2,
      recur: 1,
      shift: 1,
      age: 1,
    });
    expect(nudges.filter((nudge) => nudge.sev === 'high')).toHaveLength(6);
    expect(nudges.map((nudge) => nudge.sev)).toEqual(
      expect.arrayContaining(['high', 'med', 'low']),
    );
    expect(new Set(nudges.flatMap((nudge) => nudge.machines)).size).toBe(29);
    const never = ['amc', 'legal', 'spares', 'cell', 'spike', 'good', 'hum', 'team'];
    expect(nudges.every((nudge) => !never.includes(nudge.rule))).toBe(true);
  });
});

/**
 * NOT key-pinned: the key's plant has no AMC start date, no legal test date, no spares cost and no cell, trend,
 * human, shift or team breach, so those nine rules are pinned only here, on a hand-built plant.
 */
describe('the nine rules the key cannot pin (tiny plant, not key-pinned)', () => {
  const patternRows: RowSpec[] = [
    { id: 'r1', machineId: 'M-1', age: 0, code: 'ATC', doneBy: ['p-1'] },
    { id: 'r2', machineId: 'M-1', age: 1, code: 'ATC', doneBy: ['p-1'] },
    { id: 'r3', machineId: 'M-1', age: 2, code: 'ATC', doneBy: ['p-1'] },
    { id: 'r4', machineId: 'M-2', age: 3, code: 'ATC', doneBy: ['p-1'] },
    { id: 'r5', machineId: 'M-2', age: 4, code: 'ATC', doneBy: ['p-1'] },
    { id: 'r6', machineId: 'M-1', age: 5, code: 'HUM', doneBy: ['p-1'] },
    { id: 'r7', machineId: 'M-2', age: 6, code: 'HUM', doneBy: ['p-1'] },
    { id: 'r8', machineId: 'M-3', age: 7, code: 'HUM', doneBy: ['p-1'], spareCost: 600 },
    { id: 'r9', machineId: 'M-3', age: 8, code: 'HUM', spareCost: 600 },
    { id: 'r10', machineId: 'M-1', age: 9, spareCost: 300 },
    { id: 'r11', machineId: 'M-2', age: 10, spareCost: 300 },
    { id: 'r12', machineId: 'M-1', age: 11, hours: 15 },
    { id: 'r13', machineId: 'M-1', age: 12 },
    { id: 'r14', machineId: 'M-1', age: 13 },
    { id: 'r15', machineId: 'M-1', age: 14 },
    { id: 'r16', machineId: 'M-1', age: 15 },
    { id: 'r17', machineId: 'M-2', age: 16, shift: '2' },
    { id: 'r18', machineId: 'M-2', age: 17, shift: '2' },
    { id: 'r19', machineId: 'M-2', age: 18, shift: '2' },
    { id: 'r20', machineId: 'M-2', age: 19, shift: '2' },
  ];
  const amc: AmcLine = {
    id: 'amc-1',
    machineId: 'M-1',
    type: 'AMC',
    start: '2025-11-17',
    months: 12,
    vendor: null,
    noRenew: false,
  };
  const legal: LegalLine = {
    id: 'legal-1',
    machineId: 'M-2',
    tid: 'lgt-1',
    name: 'Test Of Pressure Vessel',
    form: 'Form No 11',
    last: '2025-11-14',
    months: 12,
    cert: null,
  };
  const patternPlant = plant({
    machines: [machine('M-1'), machine('M-2'), machine('M-3')],
    rows: patternRows,
    amc: [amc],
    legal: [legal],
  });
  const nudges = actionCenterNudges({ data: patternPlant, asOf: AS_OF, profile: DEFAULT_PROFILE });

  it('raises same-cause-in-a-cell, human mistakes, shift, team and spares', () => {
    expect(nudgeFor(nudges, 'cell|7|ATC')).toEqual({
      key: 'cell|7|ATC',
      rule: 'cell',
      sev: 'med',
      title: 'Cell 7: ATC (Automatic Tool Changer) on 2 machines (5 breakdowns in 7 days)',
      machines: ['M-1', 'M-2'],
      entries: 5,
    });
    expect(nudgeFor(nudges, 'hum|all')).toEqual({
      key: 'hum|all',
      rule: 'hum',
      sev: 'med',
      title: 'Human mistakes caused 20% of breakdowns in the last 30 days (4 of 20)',
      machines: ['M-3', 'M-1', 'M-2'],
      entries: 4,
    });
    expect(nudgeFor(nudges, 'shift|1')).toEqual({
      key: 'shift|1',
      rule: 'shift',
      sev: 'low',
      title: 'Shift 1 had 80% of breakdowns in the last 30 days',
      machines: [],
      entries: 16,
    });
    expect(nudgeFor(nudges, 'team|Person 51')).toEqual({
      key: 'team|Person 51',
      rule: 'team',
      sev: 'low',
      title: 'Person 51 attended 40% of breakdowns in the last 30 days',
      machines: [],
      entries: 8,
    });
    expect(nudgeFor(nudges, 'spares|M-3')).toEqual({
      key: 'spares|M-3',
      rule: 'spares',
      sev: 'med',
      title: 'M-3 used 67% of all spares spend in the last 90 days',
      machines: ['M-3'],
      entries: 2,
    });
  });

  it('raises the AMC and legal nudges, and a later line clears them', () => {
    expect(nudgeFor(nudges, 'amc|amc-1|2026-11-16')).toEqual({
      key: 'amc|amc-1|2026-11-16',
      rule: 'amc',
      sev: 'high',
      title: 'M-1: AMC ends in 5 days',
      machines: ['M-1'],
      entries: 0,
    });
    expect(nudgeFor(nudges, 'legal|legal-1|2026-11-14')).toEqual({
      key: 'legal|legal-1|2026-11-14',
      rule: 'legal',
      sev: 'high',
      title: 'M-2: Test Of Pressure Vessel (Form Form No 11) due in 3 days',
      machines: ['M-2'],
      entries: 0,
    });
    const renewed = plant({
      machines: [machine('M-1'), machine('M-2'), machine('M-3')],
      rows: patternRows,
      amc: [amc, { ...amc, id: 'amc-2', start: '2026-01-17' }],
      legal: [legal, { ...legal, id: 'legal-2', last: '2025-12-14' }],
    });
    const fresh = actionCenterNudges({ data: renewed, asOf: AS_OF, profile: DEFAULT_PROFILE });
    expect(keys(fresh)).not.toContain('amc|amc-1|2026-11-16');
    expect(keys(fresh)).not.toContain('legal|legal-1|2026-11-14');
  });

  it('raises a plant trend on a spike and good news on a quiet week, never both', () => {
    const spikePlant = plant({
      machines: [machine('S-1')],
      rows: [
        { id: 's3', machineId: 'S-1', age: 1, hours: 8 },
        { id: 's4', machineId: 'S-1', age: 2, hours: 8 },
        { id: 's1', machineId: 'S-1', age: 10, hours: 3 },
        { id: 's2', machineId: 'S-1', age: 17, hours: 3 },
        { id: 's5', machineId: 'S-1', age: 24, hours: 3 },
        { id: 's6', machineId: 'S-1', age: 31, hours: 3 },
      ],
    });
    const spike = actionCenterNudges({ data: spikePlant, asOf: AS_OF, profile: DEFAULT_PROFILE });
    expect(nudgeFor(spike, 'spike|hrs')).toEqual({
      key: 'spike|hrs',
      rule: 'spike',
      sev: 'high',
      title: 'Downtime this week is 433% above the recent weekly average',
      machines: ['S-1'],
      entries: 2,
    });
    expect(keys(spike)).not.toContain('good|hrs');

    const goodPlant = plant({
      machines: [machine('G-1')],
      rows: [
        { id: 'g1', machineId: 'G-1', age: 1, hours: 2 },
        { id: 'g2', machineId: 'G-1', age: 10, hours: 12 },
        { id: 'g3', machineId: 'G-1', age: 17, hours: 12 },
        { id: 'g4', machineId: 'G-1', age: 24, hours: 12 },
        { id: 'g5', machineId: 'G-1', age: 31, hours: 12 },
      ],
    });
    const good = actionCenterNudges({ data: goodPlant, asOf: AS_OF, profile: DEFAULT_PROFILE });
    expect(nudgeFor(good, 'good|hrs')).toEqual({
      key: 'good|hrs',
      rule: 'good',
      sev: 'info',
      title: 'Downtime this week is 83% below the recent weekly average',
      machines: [],
      entries: 1,
    });
    expect(keys(good)).not.toContain('spike|hrs');
  });

  it('suppresses the long-breakdown nudge once its ticket has a saved Why-Why', () => {
    expect(nudgeFor(nudges, 'long|r12')).toEqual({
      key: 'long|r12',
      rule: 'long',
      sev: 'med',
      title: 'M-1: 15.0 hrs breakdown on 31-10-2026 has no root-cause analysis',
      machines: ['M-1'],
      entries: 1,
    });
    const saved: WhyWhyRow = {
      ticketId: 't-r12',
      whys: ['One', 'Two', 'Three', 'Four', 'Five'],
      conclusion: 'The spindle drive was replaced.',
      completedBy: 'p-1',
      completedDate: '2026-11-05',
    };
    const withSaved = plant({
      machines: [machine('M-1'), machine('M-2'), machine('M-3')],
      rows: patternRows,
      amc: [amc],
      legal: [legal],
      whyWhy: [saved],
    });
    const after = actionCenterNudges({ data: withSaved, asOf: AS_OF, profile: DEFAULT_PROFILE });
    expect(keys(after)).not.toContain('long|r12');
    expect(after).toHaveLength(nudges.length - 1);
  });
});
