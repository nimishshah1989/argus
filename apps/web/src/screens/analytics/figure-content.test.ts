import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { en, gu, type MessageKey } from '@uptimo/shared/i18n';
import { contentKind, contentOf } from './figure-content.js';

/** The frozen A5 key, read as data: every tile is pinned against it, raw floats included. */
const A5_KEY: unknown = JSON.parse(
  readFileSync(
    new URL('../../../../../fixtures/answer-key/a5-energy.json', import.meta.url),
    'utf8',
  ),
);

/**
 * The five object figures must reach the face as content, with every chrome string looked up in the
 * catalogue and the engine's own prose carried through as data. The stub below records every key the
 * mapper asks for, so a hard-coded English label shows up as a missing call.
 */

type Figure = FiguresReply['figures'][number];
type Call = { key: string; values?: Record<string, unknown> };

const BUBBLE = {
  axes: { x: 'BD Hours (machine total)', y: 'Number of Breakdowns' },
  datasets: [
    {
      label: 'Machines',
      data: [
        { x: 12.5, y: 3, r: 10.2, id: 'CNC-01', model: 'VMC 850', age: '2 yrs', mttr: 4.1667 },
        { x: 30, y: 5, r: 18.4, id: 'CNC-02', model: '—', age: '—', mttr: 6 },
      ],
    },
  ],
};

const TIMELINE = {
  axes: { x: '', y: '', y1: '' },
  labels: [2024, 2025, 2026],
  datasets: [
    { label: 'VC', data: [2, 1, 0] },
    { label: 'TC', data: [0, 1, 1] },
    { label: 'Cumulative Fleet Size', data: [2, 4, 5] },
  ],
};

const COSTLIEST = {
  rows: [
    { problem: 'Axis motor / drive / encoder / servo', hours: 485, share: 15.85, breakdowns: 104 },
    { problem: 'Machine accident / crash', hours: 307, share: 10.02, breakdowns: 41 },
  ],
  totalHours: 3060.1,
};

const CHECKLIST = {
  counts: { mc_dim: 1, ww: 1, log_gap: 1, bd_date: 2 },
  items: [
    { group: 'mc_dim', key: 'mc_dim|machines|CNC-07', plain: 'CNC-07 — length and width missing' },
    { group: 'ww', key: 'ww|r8', plain: '08 Nov · CNC-03 — 12.0 hrs, Why-Why not done' },
    { group: 'log_gap', key: 'log_gap|a|b', plain: '03 Nov to 07 Nov — 5 days with no entries' },
    { group: 'bd_date', key: 'bd_date|r1', plain: '01 Nov · CNC-01 — date missing or invalid' },
    { group: 'bd_date', key: 'bd_date|r2', plain: '02 Nov · CNC-02 — date missing or invalid' },
  ],
};

function translator(): { t: TFunction; calls: Call[] } {
  const calls: Call[] = [];
  const t = ((key: string, values?: Record<string, unknown>) => {
    calls.push(values === undefined ? { key } : { key, values });
    const template = en[key as MessageKey] ?? key;
    return Object.entries(values ?? {}).reduce(
      (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
      template,
    );
  }) as unknown as TFunction;
  return { t, calls };
}

function figure(key: string, value: unknown, screen = 'dashboard'): Figure {
  return {
    key,
    screen,
    owner: 38,
    status: 'ready',
    value,
    drill: { type: 'ticket', ids: [] },
  };
}

describe('the bubble chart figure', () => {
  it('maps every engine point to a scatter point, machine id as label and MTTR carried', () => {
    const { t, calls } = translator();
    const source = figure('dashboard.bubble-chart', BUBBLE);
    expect(contentKind(source)).toBe('chart');
    const content = contentOf(source, t);
    if (content?.kind !== 'chart' || content.spec.kind !== 'scatter') {
      throw new Error('expected a scatter chart');
    }
    const { points, ...chrome } = content.spec;
    expect(chrome).toEqual({
      kind: 'scatter',
      title: 'Breakdowns against downtime',
      machineLabel: 'Machine',
      xLabel: 'Downtime hours',
      yLabel: 'Breakdowns',
      mttrLabel: 'MTTR',
    });
    expect(points).toHaveLength(2);
    expect(points).toEqual([
      { x: 12.5, y: 3, r: 10.2, label: 'CNC-01', mttr: 4.1667 },
      { x: 30, y: 5, r: 18.4, label: 'CNC-02', mttr: 6 },
    ]);
    expect(calls.map((call) => call.key)).toEqual([
      'analytics.content.bubble.title',
      'analytics.content.bubble.machineLabel',
      'analytics.content.bubble.xLabel',
      'analytics.content.bubble.yLabel',
      'analytics.content.bubble.mttrLabel',
    ]);
  });
});

describe('the bubble chart on a plant whose machine ids are UUIDs', () => {
  it('labels each point with the machine code, never the id the point is looked up by', () => {
    const uuid = '3f1c2a9e-5b7d-4c68-9a10-2e4d6f8a0b12';
    const value = {
      ...BUBBLE,
      datasets: [
        {
          label: 'Machines',
          data: [{ x: 12.5, y: 3, r: 10.2, id: uuid, code: 'CNC-01', model: '—', mttr: 4.1667 }],
        },
      ],
    };
    const content = contentOf(figure('dashboard.bubble-chart', value), translator().t);
    if (content?.kind !== 'chart' || content.spec.kind !== 'scatter') {
      throw new Error('expected a scatter chart');
    }
    expect(content.spec.points.map((point) => point.label)).toEqual(['CNC-01']);
  });
});

describe('the expansion timeline figure', () => {
  it('maps the engine labels to categories, the prefix datasets to bars and the cumulative series to the line', () => {
    const { t, calls } = translator();
    const source = figure('dashboard.expansion-timeline', TIMELINE);
    expect(contentKind(source)).toBe('chart');
    const content = contentOf(source, t);
    if (content?.kind !== 'chart') throw new Error('expected a chart');
    expect(content.spec).toEqual({
      kind: 'mixed',
      title: 'Machine expansion timeline',
      categoryLabel: 'Year',
      categories: ['2024', '2025', '2026'],
      bars: [
        { name: 'VC', values: [2, 1, 0] },
        { name: 'TC', values: [0, 1, 1] },
      ],
      line: { name: 'Cumulative Fleet Size', values: [2, 4, 5] },
      legend: true,
      draw: true,
    });
    expect(calls.map((call) => call.key)).toEqual([
      'analytics.content.timeline.title',
      'analytics.content.timeline.categoryLabel',
    ]);
  });
});

describe('the breakdown-free figure', () => {
  it('interpolates the clean count and the fleet size into catalogue text', () => {
    const { t, calls } = translator();
    const source = figure('dashboard.breakdown-free', { runningClean: 53, inService: 125 });
    expect(contentKind(source)).toBe('text');
    expect(contentOf(source, t)).toEqual({ kind: 'text', text: '53 of 125 machines' });
    expect(calls).toEqual([
      { key: 'analytics.content.breakdownFree.text', values: { clean: 53, total: 125 } },
    ]);
  });
});

describe('the costliest problems figure', () => {
  it('builds the catalogue header, the formatted engine rows and the total-hours caption', () => {
    const { t, calls } = translator();
    const source = figure('dashboard.costliest-problems', COSTLIEST);
    expect(contentKind(source)).toBe('table');
    expect(contentOf(source, t)).toEqual({
      kind: 'table',
      header: ['Problem', 'BD hours', '% of BD', 'Breakdowns'],
      rows: [
        ['Axis motor / drive / encoder / servo', '485.0', '15.85%', '104'],
        ['Machine accident / crash', '307.0', '10.02%', '41'],
      ],
      caption: 'Total downtime: 3,060.1 hours',
    });
    expect(calls.map((call) => call.key)).toEqual([
      'analytics.content.costliest.problem',
      'analytics.content.costliest.hours',
      'analytics.content.costliest.share',
      'analytics.content.costliest.breakdowns',
      'analytics.content.costliest.caption',
    ]);
  });
});

describe('the data checklist figure', () => {
  it('groups the engine item sentences in the engine group order and labels each group from the catalogue', () => {
    const { t, calls } = translator();
    const source = figure('data-checklist', CHECKLIST, 'data-checklist');
    expect(contentKind(source)).toBe('list');
    expect(contentOf(source, t)).toEqual({
      kind: 'list',
      groups: [
        {
          label: 'Date',
          rows: [
            '01 Nov · CNC-01 — date missing or invalid',
            '02 Nov · CNC-02 — date missing or invalid',
          ],
        },
        { label: 'Log gaps', rows: ['03 Nov to 07 Nov — 5 days with no entries'] },
        { label: 'Why-Why', rows: ['08 Nov · CNC-03 — 12.0 hrs, Why-Why not done'] },
        { label: 'Dimensions', rows: ['CNC-07 — length and width missing'] },
      ],
    });
    expect(calls.map((call) => call.key)).toEqual([
      'analytics.checklist.group.bd_date',
      'analytics.checklist.group.log_gap',
      'analytics.checklist.group.ww',
      'analytics.checklist.group.mc_dim',
    ]);
  });
});

describe('the A5 energy figure', () => {
  interface Bucket {
    key: string;
    machines: number;
    totalKva: number;
    avgKva: number;
    runningKva: number;
    avgRunningKva: number;
    machineIds: string[];
  }
  const A5 = A5_KEY as unknown as {
    pages: { title: string }[];
    extra: { effFactorPct: number; byCell: Bucket[]; byLocation: Bucket[] };
  };
  const tile = (bucket: Bucket) => ({
    key: bucket.key,
    machines: bucket.machines,
    connectedKva: bucket.totalKva,
    avgConnectedKva: bucket.avgKva,
    runningKva: bucket.runningKva,
    avgRunningKva: bucket.avgRunningKva,
    machineIds: bucket.machineIds,
  });

  it('maps every key tile whole: both heat grids and the per-machine average grid', () => {
    const { t } = translator();
    const source = figure('a5-energy', A5_KEY, 'a5-energy');
    expect(contentKind(source)).toBe('energy');
    expect(contentOf(source, t)).toEqual({
      kind: 'energy',
      title: 'Energy Heatmap',
      effFactorPct: A5.extra.effFactorPct,
      byCell: {
        axis: 'cell',
        showRunning: true,
        tiles: A5.extra.byCell.map(tile),
      },
      byLocation: {
        axis: 'location',
        showRunning: true,
        tiles: A5.extra.byLocation.map(tile),
      },
      byMachine: {
        axis: 'cell',
        showRunning: false,
        tiles: A5.extra.byCell.map((bucket) => ({
          ...tile(bucket),
          connectedKva: bucket.avgKva,
        })),
      },
    });
  });

  it('keeps the key raw floats, the bucket order and every machine id', () => {
    const { t } = translator();
    const content = contentOf(figure('a5-energy', A5_KEY, 'a5-energy'), t);
    if (content?.kind !== 'energy') throw new Error('expected the A5 energy content');
    expect(content.effFactorPct).toBe(20);
    expect(content.byCell.tiles.map((entry) => entry.key)).toEqual(
      A5.extra.byCell.map((bucket) => bucket.key),
    );
    expect(content.byLocation.tiles.map((entry) => entry.key)).toEqual(
      A5.extra.byLocation.map((bucket) => bucket.key),
    );
    expect(content.byCell.tiles[1]?.runningKva).toBe(97.40000000000002);
    expect(content.byCell.tiles[0]?.machineIds).toEqual(A5.extra.byCell[0]?.machineIds);
    expect(content.byCell.tiles[0]?.machineIds).toContain('BOXY');
    expect(content.byMachine.tiles.map((entry) => entry.connectedKva)).toEqual(
      A5.extra.byCell.map((bucket) => bucket.avgKva),
    );
  });

  it('maps a missing or empty extra to nothing, never to a fabricated grid', () => {
    const { t } = translator();
    for (const value of [
      null,
      {},
      { extra: {} },
      { extra: { effFactorPct: 20, byCell: [], byLocation: [] } },
      { extra: { effFactorPct: 20, byCell: [{ key: '1' }], byLocation: [] } },
    ])
      expect(
        contentOf(figure('a5-energy', value, 'a5-energy'), t),
        JSON.stringify(value),
      ).toBeNull();
    expect(contentKind(figure('a5-energy', A5_KEY, 'a5-energy'))).toBe('energy');
  });

  it('names every A4/A5 screen string in both catalogues', () => {
    const keys: MessageKey[] = [
      'analytics.content.a4.countChart',
      'analytics.content.a4.personAxis',
      'analytics.specialization.toggle',
      'analytics.specialization.category',
      'analytics.specialization.code',
      'analytics.energy.cellTitle',
      'analytics.energy.locationTitle',
      'analytics.energy.machineTitle',
      'analytics.energy.cellDescription',
      'analytics.energy.locationDescription',
      'analytics.energy.machineDescription',
      'analytics.energy.connected',
      'analytics.energy.running',
      'analytics.energy.unit',
      'analytics.energy.machines',
      'analytics.energy.oneMachine',
      'analytics.energy.avg',
      'analytics.energy.noMachines',
      'analytics.energy.noCell',
      'analytics.energy.drillCell',
      'analytics.energy.drillLocation',
      'analytics.energy.back',
    ];
    for (const key of keys) {
      expect(en[key], key).toBeTruthy();
      expect(gu, key).toHaveProperty(key);
    }
  });
});

describe('the pm-compliance figure', () => {
  const COMPLIANCE = {
    from: '2026-01-01',
    to: '2026-11-11',
    pm: {
      eligible: 8,
      onTime: 2,
      early: 1,
      late: 2,
      overdue: 2,
      cancelled: 1,
      pending: 1,
      pct: 25,
    },
    schedule: { eligible: 11, done: 3, missed: 8, pending: 0, pct: 27.3 },
  };

  it('prints the period and both rates as one row, with the counts behind them in the caption', () => {
    const { t, calls } = translator();
    const source = figure('pm-compliance', COMPLIANCE, 'pm-calendar');
    expect(contentKind(source)).toBe('table');
    expect(contentOf(source, t)).toEqual({
      kind: 'table',
      header: ['Period', 'PM compliance', 'Schedule compliance'],
      rows: [['2026-01-01 – 2026-11-11', '25.0 %', '27.3 %']],
      caption: '2 of 8 PM jobs on time; 3 of 11 planned jobs done by their week.',
    });
    expect(calls.map((call) => call.key)).toEqual([
      'pm.compliance.period',
      'pm.compliance.pm',
      'pm.compliance.schedule',
      'pm.compliance.counts',
    ]);
  });

  it('says so in words, never 0 %, when the window holds no planned work order', () => {
    const { t } = translator();
    const empty = {
      from: '2026-01-01',
      to: '2026-11-11',
      pm: { ...COMPLIANCE.pm, eligible: 0, onTime: 0, pct: null },
      schedule: { ...COMPLIANCE.schedule, eligible: 0, done: 0, pct: null },
    };
    expect(contentOf(figure('pm-compliance', empty, 'pm-calendar'), t)).toEqual({
      kind: 'text',
      text: 'No PM work orders in this window.',
    });
  });

  it('prints a dash for a null rate even when the other rate has a denominator', () => {
    const { t } = translator();
    const pmOnly = {
      ...COMPLIANCE,
      pm: { ...COMPLIANCE.pm, eligible: 0, onTime: 0, pct: null },
    };
    const content = contentOf(figure('pm-compliance', pmOnly, 'pm-calendar'), t);
    if (content?.kind !== 'table') throw new Error('expected a table');
    expect(content.rows[0]).toEqual(['2026-01-01 – 2026-11-11', '—', '27.3 %']);
  });
});

describe('values the mapper cannot draw', () => {
  it('maps a ready null value to nothing for every object figure', () => {
    const { t } = translator();
    for (const key of [
      'dashboard.bubble-chart',
      'dashboard.expansion-timeline',
      'dashboard.breakdown-free',
      'dashboard.costliest-problems',
      'data-checklist',
    ]) {
      const source = figure(key, null);
      expect(contentKind(source), key).toBeNull();
      expect(contentOf(source, t), key).toBeNull();
    }
  });

  it('maps an unknown non-null object and a not-computed figure to nothing', () => {
    const { t } = translator();
    const unknown = figure('dashboard.total-machines', { anything: 1 });
    expect(contentKind(unknown)).toBeNull();
    expect(contentOf(unknown, t)).toBeNull();
    const held = { ...figure('dashboard.bubble-chart', BUBBLE), status: 'not_computed' as const };
    expect(contentKind(held)).toBeNull();
    expect(contentOf(held, t)).toBeNull();
  });
});

describe('the copy catalogue', () => {
  it('names every chrome string the mapper asks for, in both catalogues, and retires Ready', () => {
    const keys: MessageKey[] = [
      'analytics.content.bubble.title',
      'analytics.content.bubble.machineLabel',
      'analytics.content.bubble.xLabel',
      'analytics.content.bubble.yLabel',
      'analytics.content.bubble.mttrLabel',
      'analytics.content.timeline.title',
      'analytics.content.timeline.categoryLabel',
      'analytics.content.breakdownFree.text',
      'analytics.content.costliest.problem',
      'analytics.content.costliest.hours',
      'analytics.content.costliest.share',
      'analytics.content.costliest.breakdowns',
      'analytics.content.costliest.caption',
      'analytics.checklist.group.bd_date',
      'analytics.checklist.group.bd_mach',
      'analytics.checklist.group.bd_hrs',
      'analytics.checklist.group.bd_code',
      'analytics.checklist.group.bd_done',
      'analytics.checklist.group.bd_prob',
      'analytics.checklist.group.bd_shift',
      'analytics.checklist.group.bd_obs',
      'analytics.checklist.group.bd_em',
      'analytics.checklist.group.log_gap',
      'analytics.checklist.group.ww',
      'analytics.checklist.group.mc_age',
      'analytics.checklist.group.mc_dim',
      'analytics.checklist.group.mc_pw',
      'analytics.checklist.group.mc_cell',
      'analytics.checklist.group.mc_loc',
      'pm.compliance.period',
      'pm.compliance.pm',
      'pm.compliance.schedule',
      'pm.compliance.counts',
      'pm.compliance.empty',
    ];
    for (const key of keys) {
      expect(en[key], key).toBeTruthy();
      expect(gu, key).toHaveProperty(key);
    }
    expect(en).not.toHaveProperty('analytics.value.ready');
  });
});
