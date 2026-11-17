import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { en, gu, type MessageKey } from '@uptimo/shared/i18n';
import { contentKind, contentOf } from './figure-content.js';

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
    ];
    for (const key of keys) {
      expect(en[key], key).toBeTruthy();
      expect(gu, key).toHaveProperty(key);
    }
    expect(en).not.toHaveProperty('analytics.value.ready');
  });
});
