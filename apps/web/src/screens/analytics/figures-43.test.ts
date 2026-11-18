import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { en, gu, type MessageKey } from '@uptimo/shared/i18n';
import { contentKind, contentOf } from './figure-content.js';
import { mayReadMoney } from './MoneyPage.js';
import { focusActions, focusLaneGroups, focusStatusKey } from './team-focus-actions.js';

/** The four frozen 11 November keys, read as data: every cell, series and action is pinned against them. */
const COMPARE = keyOf('compare');
const TEAM = keyOf('team-focus');
const MONEY = keyOf('money-matters');
const FIX = keyOf('fix-finder');

interface KeyTable {
  title: string;
  header: string[];
  rows: string[][];
  rowCount: number;
}

interface KeyChart {
  id: string;
  labels: string[];
  datasets: { label: string; data: number[] }[];
}

interface KeyPage {
  page: string;
  title: string;
  kpis: { label: string; value: string; sub: string }[];
  tables: KeyTable[];
  charts: KeyChart[];
}

interface RawAction {
  key: string;
  lane: string;
  machine?: string;
  title: string;
  stake: number;
  status: string;
  owner: string;
  note: string;
}

interface KeyFile {
  pages: KeyPage[];
  extra?: RawAction[];
}

type Figure = FiguresReply['figures'][number];
type Call = { key: string; values?: Record<string, unknown> };

function keyOf(name: string): KeyFile {
  return JSON.parse(
    readFileSync(
      new URL(`../../../../../fixtures/answer-key/${name}.json`, import.meta.url),
      'utf8',
    ),
  ) as KeyFile;
}

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

function figure(key: string, value: unknown): Figure {
  return {
    key,
    screen: key,
    owner: 43,
    status: 'ready',
    value,
    drill: { type: 'machine', ids: [] },
  };
}

/** A key page's tables as the mapper prints them: the same cells, the truncation flag and the sort rule. */
function expectedTables(page: KeyPage, sortable: readonly number[]) {
  return page.tables.map((table, index) => ({
    ...table,
    truncated: false,
    ...(sortable.includes(index) ? { sortable: true } : {}),
  }));
}

const CMP = COMPARE.pages[0]!;
const MM = MONEY.pages[0]!;
const FF = FIX.pages[0]!;
const TF = TEAM.pages[0]!;

describe('the Compare Machines page', () => {
  it('maps the key page whole: no KPIs, all six tables (every cell) and both chart series', () => {
    const { t, calls } = translator();
    const source = figure('compare', COMPARE);
    expect(contentKind(source)).toBe('page');
    const content = contentOf(source, t);
    if (content?.kind !== 'page') throw new Error('expected the Compare page');
    const [code, month] = CMP.charts;
    expect(content.title).toBe(CMP.title);
    expect(content.kpis).toEqual([]);
    expect(content.tables).toEqual(expectedTables(CMP, [3, 4, 5]));
    expect(content.tables).toHaveLength(6);
    expect(content.charts).toEqual([
      {
        kind: 'bar',
        title: 'BD hours by maintenance code',
        categoryLabel: 'Maintenance code',
        valueLabel: 'BD hours',
        categories: code!.labels,
        series: code!.datasets.map((dataset) => ({ name: dataset.label, values: dataset.data })),
      },
      {
        kind: 'line',
        title: 'BD hours by month',
        categoryLabel: 'Month',
        valueLabel: 'BD hours',
        categories: month!.labels,
        series: month!.datasets.map((dataset) => ({ name: dataset.label, values: dataset.data })),
      },
    ]);
    expect(calls.map((call) => call.key)).toEqual([
      'analytics.content.cmp.codeChart',
      'analytics.content.cmp.codeAxis',
      'analytics.content.cmp.hoursAxis',
      'analytics.content.cmp.monthChart',
      'analytics.content.cmp.monthAxis',
      'analytics.content.cmp.hoursAxis',
    ]);
  });

  it('pins the scorecard row cells and the by-shift cells exactly as the key printed them', () => {
    const { t } = translator();
    const content = contentOf(figure('compare', COMPARE), t);
    if (content?.kind !== 'page') throw new Error('expected the Compare page');
    expect(content.tables[0]?.rows).toEqual(CMP.tables[0]!.rows);
    expect(content.tables[0]?.rows[0]?.[1]).toBe('3.927 breakdowns against 13.2 expected');
    expect(content.tables[5]?.rows).toEqual(CMP.tables[5]!.rows);
    expect(
      content.tables.filter((table) => table.sortable === true).map((table) => table.title),
    ).toEqual([CMP.tables[3]!.title, CMP.tables[4]!.title, CMP.tables[5]!.title]);
  });
});

describe('the Money Matters page', () => {
  it('maps the key page whole: all ten KPIs, both tables (every cell) and the one chart series', () => {
    const { t, calls } = translator();
    const source = figure('money-matters', MONEY);
    expect(contentKind(source)).toBe('page');
    const content = contentOf(source, t);
    if (content?.kind !== 'page') throw new Error('expected the Money page');
    const chart = MM.charts[0]!;
    expect(content.title).toBe(MM.title);
    expect(content.kpis).toEqual(MM.kpis.map(({ label, value, sub }) => ({ label, value, sub })));
    expect(content.kpis).toHaveLength(10);
    expect(content.tables).toEqual(expectedTables(MM, [0, 1]));
    expect(content.tables).toHaveLength(2);
    expect(content.tables[1]?.rows).toHaveLength(24);
    expect(content.charts).toEqual([
      {
        kind: 'bar',
        title: 'Where the money was lost',
        categoryLabel: 'Problem',
        valueLabel: 'Money lost in the period (₹ lakh)',
        categories: chart.labels,
        series: [{ name: 'Money lost (₹ lakh)', values: chart.datasets[0]!.data }],
        horizontal: true,
      },
    ]);
    expect(calls.map((call) => call.key)).toEqual([
      'analytics.content.mm.value',
      'analytics.content.mm.chart',
      'analytics.content.mm.problemAxis',
      'analytics.content.mm.valueAxis',
    ]);
  });

  it('pins the overlap-free lever row and a lost-hours row cell against the key', () => {
    const { t } = translator();
    const content = contentOf(figure('money-matters', MONEY), t);
    if (content?.kind !== 'page') throw new Error('expected the Money page');
    expect(content.tables[0]?.rows[4]).toEqual(MM.tables[0]!.rows[4]);
    expect(content.tables[0]?.rows[4]?.[3]).toBe('₹ 38.23 lakh');
    expect(content.tables[1]?.rows[0]).toEqual(MM.tables[1]!.rows[0]);
    expect(content.tables[1]?.rows[0]?.[5]).toBe('15.8%');
  });
});

describe('the Fix Finder page', () => {
  it('maps the key page whole: all four KPIs and the 15 rows in the key order', () => {
    const { t, calls } = translator();
    const source = figure('fix-finder', FIX);
    expect(contentKind(source)).toBe('page');
    const content = contentOf(source, t);
    if (content?.kind !== 'page') throw new Error('expected the Fix Finder page');
    expect(content.title).toBe(FF.title);
    expect(content.kpis).toEqual(FF.kpis.map(({ label, value, sub }) => ({ label, value, sub })));
    expect(content.kpis).toHaveLength(4);
    expect(content.tables).toEqual(expectedTables(FF, [0]));
    expect(content.tables[0]?.rows).toHaveLength(15);
    expect(content.tables[0]?.rows[0]).toEqual(FF.tables[0]!.rows[0]);
    expect(content.tables[0]?.rows[14]).toEqual(FF.tables[0]!.rows[14]);
    expect(content.charts).toEqual([]);
    expect(calls).toEqual([]);
  });
});

describe('the Team Focus page', () => {
  it('maps the three KPIs and no tables or charts', () => {
    const { t } = translator();
    const source = figure('team-focus', TEAM);
    expect(contentKind(source)).toBe('page');
    const content = contentOf(source, t);
    if (content?.kind !== 'page') throw new Error('expected the Team Focus page');
    expect(content.title).toBe(TF.title);
    expect(content.kpis).toEqual(TF.kpis.map(({ label, value, sub }) => ({ label, value, sub })));
    expect(content.tables).toEqual([]);
    expect(content.charts).toEqual([]);
  });

  it('reads every one of the 31 actions with its key, lane, machine, title, stake and defaults', () => {
    const actions = focusActions(TEAM);
    expect(actions).toHaveLength(31);
    expect(actions).toEqual(
      TEAM.extra!.map((action) => ({
        key: action.key,
        lane: action.lane,
        machine: action.machine ?? null,
        title: action.title,
        stake: action.stake,
        status: action.status,
        owner: action.owner,
        note: action.note,
      })),
    );
    expect(actions[0]).toEqual({
      key: 'fc|WJ-01|2026-12',
      lane: 'A',
      machine: 'WJ-01',
      title: 'WJ-01 (WaterJet CNC): inspect before December 2026',
      stake: 6.09,
      status: 'open',
      owner: '',
      note: '',
    });
    expect(actions.filter((action) => action.machine === null)).toHaveLength(7);
  });

  it('groups the actions by lane A, B, C, F, D, E in the key order', () => {
    const groups = focusLaneGroups(focusActions(TEAM));
    expect(groups.map((group) => group.lane)).toEqual(['A', 'B', 'C', 'F', 'D', 'E']);
    expect(groups.map((group) => group.actions.length)).toEqual([8, 9, 5, 2, 5, 2]);
    expect(groups.flatMap((group) => group.actions.map((action) => action.key))).toEqual(
      TEAM.extra!.map((action) => action.key),
    );
  });

  it('names the platform status defaults, and reads an unknown status honestly', () => {
    expect(focusStatusKey('open')).toBe('analytics.teamFocus.status.open');
    expect(focusStatusKey('prog')).toBe('analytics.teamFocus.status.prog');
    expect(focusStatusKey('done')).toBe('analytics.teamFocus.status.done');
    expect(focusStatusKey('skip')).toBe('analytics.teamFocus.status.skip');
    expect(focusStatusKey('made-up')).toBe('analytics.teamFocus.status.open');
    expect(focusActions({ extra: [{ lane: 'Z' }] })).toEqual([]);
    expect(focusActions(null)).toEqual([]);
  });
});

describe('the money screen role gate', () => {
  it('reads the server money rule: head, plant head and admin, never the floor', () => {
    for (const role of ['head', 'plant_head', 'admin']) expect(mayReadMoney(role), role).toBe(true);
    for (const role of ['supervisor', 'technician', 'operator', undefined])
      expect(mayReadMoney(role), String(role)).toBe(false);
  });
});

describe('the 43e copy catalogue', () => {
  it('names every new chrome string in both catalogues', () => {
    const keys: MessageKey[] = [
      'analytics.content.cmp.codeChart',
      'analytics.content.cmp.codeAxis',
      'analytics.content.cmp.monthChart',
      'analytics.content.cmp.monthAxis',
      'analytics.content.cmp.hoursAxis',
      'analytics.content.mm.chart',
      'analytics.content.mm.problemAxis',
      'analytics.content.mm.value',
      'analytics.content.mm.valueAxis',
      'analytics.today.nav',
      'analytics.teamFocus.listTitle',
      'analytics.teamFocus.openOf',
      'analytics.teamFocus.machine',
      'analytics.teamFocus.stake',
      'analytics.teamFocus.status',
      'analytics.teamFocus.owner',
      'analytics.teamFocus.note',
      'analytics.teamFocus.ownerNone',
      'analytics.teamFocus.noteNone',
      'analytics.teamFocus.lane.A',
      'analytics.teamFocus.lane.B',
      'analytics.teamFocus.lane.C',
      'analytics.teamFocus.lane.F',
      'analytics.teamFocus.lane.D',
      'analytics.teamFocus.lane.E',
      'analytics.teamFocus.hint.A',
      'analytics.teamFocus.hint.B',
      'analytics.teamFocus.hint.C',
      'analytics.teamFocus.hint.F',
      'analytics.teamFocus.hint.D',
      'analytics.teamFocus.hint.E',
      'analytics.money.refusedTitle',
      'analytics.money.refusedBody',
    ];
    for (const key of keys) {
      expect(en[key], key).toBeTruthy();
      expect(gu, key).toHaveProperty(key);
    }
  });
});
