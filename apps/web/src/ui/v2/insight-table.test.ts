// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../i18n/index.js';
import { printedTakeaway } from '../../screens/v2/insight.js';
import { DataTable } from './data-table.js';
import { EngineTable } from './domain/engine-table.js';
import { PagedTable } from './paged-table.js';
import { barOf, foldAt, missesTarget, worstFirst } from './table-model.js';
import {
  HOURS,
  WORDS,
  engineModel,
  hoursColumn,
  nameColumn,
  type Hours,
} from './insight-fixture.js';

const say = (key: string) => key;
const loss = {
  text: '3 of 10 miss 20.0 h; worst is M-02 (40.0 h).',
  tone: 'loss',
  tag: 'Loss',
} as const;

const table = (extra: object = {}) =>
  renderToStaticMarkup(
    h(DataTable<Hours>, {
      rows: HOURS,
      rowKey: (r) => r.name,
      columns: [nameColumn, hoursColumn(true)],
      filters: [],
      text: (r) => r.name,
      words: WORDS,
      ...extra,
    }),
  );
const at = (out: string, name: string) => out.indexOf(`>${name}<`);

describe('table rules (ticket 620)', () => {
  it('ranks worst first: largest first when high is worse, smallest first when low is worse', () => {
    const values = (rows: Hours[]) => rows.map((r) => r.hours);
    expect(values(worstFirst(HOURS, (r) => r.hours, 'high'))).toEqual([
      40, 30, 25, 12, 8, 5, 4, 3, 2, 1,
    ]);
    expect(values(worstFirst(HOURS, (r) => r.hours, 'low')).slice(0, 3)).toEqual([1, 2, 3]);
    expect(HOURS[0]?.hours).toBe(5);
  });

  it('draws a bar against the larger of the largest value and the target', () => {
    expect(barOf(30, 40)).toBe(0.75);
    expect(barOf(10, 10, 20)).toBe(0.5);
    expect(barOf(5, 0)).toBe(0);
  });

  it('misses a target only on the bad side', () => {
    const high = { worse: 'high', target: { value: 20, shown: '20' } } as const;
    expect(missesTarget(25, high)).toBe(true);
    expect(missesTarget(15, high)).toBe(false);
    expect(missesTarget(25, { worse: 'high' })).toBe(false);
  });

  it('folds after the misses, 3 to 5 of them, or after 5 with no target', () => {
    const values = HOURS.map((r) => r.hours);
    expect(foldAt(values, { worse: 'high', target: { value: 20, shown: '20' } })).toBe(3);
    expect(foldAt(values, { worse: 'high' })).toBe(5);
  });
});

describe('DataTable with a measure (ticket 620)', () => {
  it('opens with the takeaway, worst row first and marked, tail folded within target', () => {
    const out = table({ takeaway: loss });
    expect(out).toContain('class="v2-takeaway"');
    expect(out).toContain(loss.text);
    expect(at(out, 'M-02')).toBeGreaterThan(-1);
    expect(at(out, 'M-02')).toBeLessThan(at(out, 'M-04'));
    expect(at(out, 'M-04')).toBeLessThan(at(out, 'M-07'));
    expect(at(out, 'M-03')).toBe(-1);
    expect(out).toMatch(/<tr[^>]*data-worst="true"(?:(?!<\/tr>).)*>M-02</);
    expect(out.match(/data-worst="true"/g)).toHaveLength(1);
    expect(out.match(/v2-pill-loss/g)?.length).toBe(2);
    expect(out).toContain('class="v2-fold"');
    expect(out).toContain('+ 7 more, all within target');
  });

  it('draws the measure as a bar against the target or the largest', () => {
    const out = table();
    expect(out).toContain('v2-cellbar');
    expect(out).toContain('width:100.0%');
    expect(out).toContain('width:75.0%');
  });

  it('offers an expand button per row, closed, its detail not drawn yet', () => {
    const out = table({ expand: (r: Hours) => `Detail ${r.name}` });
    expect(out).toContain('aria-expanded="false"');
    expect(out).toContain('aria-label="Show detail: M-02"');
    expect(out).not.toContain('Detail M-02');
  });

  it('with no measure: order, rows and look as before', () => {
    const out = renderToStaticMarkup(
      h(DataTable<Hours>, {
        rows: HOURS,
        rowKey: (r) => r.name,
        columns: [nameColumn, hoursColumn(false)],
        filters: [],
        text: (r) => r.name,
        words: WORDS,
      }),
    );
    expect(at(out, 'M-01')).toBeLessThan(at(out, 'M-02'));
    expect(out).not.toContain('v2-fold');
    expect(out).not.toContain('data-worst');
    expect(out).not.toContain('v2-cellbar');
  });
});

describe('engine and server tables (ticket 620)', () => {
  it('printedTakeaway names rows by their first cell and reads the measure cell', () => {
    const line = printedTakeaway(engineModel(), say);
    expect(line?.tone).toBe('risk');
    expect(printedTakeaway({ rows: engineModel().rows }, say)).toBeNull();
  });

  it('an engine table with a measure works out its own takeaway', () => {
    const out = renderToStaticMarkup(h(EngineTable, { table: engineModel() }));
    expect(out).toContain('3 of 10 miss 20.0 h; worst is M-02 (40.0 h).');
    expect(at(out, 'M-02')).toBeLessThan(at(out, 'M-04'));
    expect(out).toContain('+ 7 more, all within target');
  });

  it('a server-paged table shows its takeaway and bars, but never folds', () => {
    const out = renderToStaticMarkup(
      h(PagedTable<Hours>, {
        rows: HOURS,
        rowKey: (r) => r.name,
        columns: [nameColumn, hoursColumn(true)],
        filters: [],
        chip: '',
        onChip: () => {},
        page: 1,
        total: 10,
        onPage: () => {},
        loading: false,
        words: { ...WORDS, page: 'Page {page}', loading: 'Loading' },
        onOpen: () => {},
        takeaway: loss,
      }),
    );
    expect(out).toContain(loss.text);
    expect(out).toContain('width:75.0%');
    expect(out).not.toContain('v2-fold');
    expect(at(out, 'M-01')).toBeLessThan(at(out, 'M-02'));
  });
});
