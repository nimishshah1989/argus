// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { printedTakeaway } from '../../../screens/v2/insight.js';
import { DataTable } from '../data-table.js';
import { PrintedDataTable } from '../domain/printed-table.js';
import {
  HOURS,
  WORDS,
  engineModel,
  hoursColumn,
  nameColumn,
  type Hours,
} from '../insight-fixture.js';
import { barOf, foldAt, missesTarget, worstFirst } from '../table-model.js';

const say = (key: string) => key;
const render = (rows: Hours[], extra: object = {}, meaning = true) =>
  renderToStaticMarkup(
    h(DataTable<Hours>, {
      rows,
      rowKey: (r) => r.name,
      columns: [nameColumn, hoursColumn(meaning)],
      filters: [],
      text: (r) => r.name,
      words: WORDS,
      ...extra,
    }),
  );
const many = (values: number[]): Hours[] => values.map((hours, at) => ({ name: `X-${at}`, hours }));

describe('table rules: edges (ticket 620, hidden)', () => {
  it('ties keep their order, non-finite values go last, the input is untouched', () => {
    const rows = many([3, Number.NaN, 7, 3, Infinity]);
    const copy = [...rows];
    expect(worstFirst(rows, (r) => r.hours, 'high').map((r) => r.name)).toEqual([
      'X-2',
      'X-0',
      'X-3',
      'X-1',
      'X-4',
    ]);
    expect(
      worstFirst(rows, (r) => r.hours, 'low')
        .slice(0, 3)
        .map((r) => r.name),
    ).toEqual(['X-0', 'X-3', 'X-2']);
    expect(rows).toEqual(copy);
  });

  it('bars: target scale, never above 1, 0 for negatives and non-finite', () => {
    expect(barOf(40, 40, 20)).toBe(1);
    expect(barOf(50, 40)).toBe(1);
    expect(barOf(-3, 40)).toBe(0);
    expect(barOf(Number.NaN, 40)).toBe(0);
    expect(barOf(0, 0, 0)).toBe(0);
  });

  it('equal meets the target either way', () => {
    expect(missesTarget(20, { worse: 'high', target: { value: 20, shown: '' } })).toBe(false);
    expect(missesTarget(20, { worse: 'low', target: { value: 20, shown: '' } })).toBe(false);
    expect(missesTarget(19, { worse: 'low', target: { value: 20, shown: '' } })).toBe(true);
  });

  it('fold: at least 3, at most 5, and never to hide a single row', () => {
    const target = { worse: 'high', target: { value: 10, shown: '' } } as const;
    expect(foldAt([1, 2, 3, 4, 5, 6, 7, 8], target)).toBe(3);
    expect(foldAt([11, 12, 13, 14, 15, 16, 17, 18], target)).toBe(5);
    expect(foldAt([11, 12, 13, 14, 1, 2], target)).toBe(4);
    expect(foldAt([1, 2, 3, 4, 5, 6], { worse: 'high' })).toBe(6);
    expect(foldAt([1, 2], { worse: 'high' })).toBe(2);
    expect(foldAt([], { worse: 'high' })).toBe(0);
  });

  it('a folded tail that still misses says only how many', () => {
    const out = render(many([30, 31, 32, 33, 34, 35, 36, 37, 1, 2, 3, 4]));
    expect(out).toContain('+ 7 more');
    expect(out).not.toContain('all within target');
  });

  it('six rows with no target: nothing folds', () => {
    const rows = many([1, 2, 3, 4, 5, 6]);
    const out = renderToStaticMarkup(
      h(DataTable<Hours>, {
        rows,
        rowKey: (r) => r.name,
        columns: [
          nameColumn,
          { ...hoursColumn(true), meaning: { worse: 'high', value: (r: Hours) => r.hours } },
        ],
        filters: [],
        text: (r) => r.name,
        words: WORDS,
      }),
    );
    expect(out).not.toContain('v2-fold');
    expect(out).toContain('>X-0<');
  });

  it("the reader's sort wins over worst first and unfolds", () => {
    const out = render(HOURS, { initialSort: { key: 'name', dir: 'asc' } });
    expect(out.indexOf('>M-01<')).toBeLessThan(out.indexOf('>M-02<'));
    expect(out).not.toContain('v2-fold');
  });

  it('a gain takeaway puts no pill on the worst row', () => {
    const out = render(HOURS, { takeaway: { text: 'All fine', tone: 'gain', tag: 'Gain' } });
    expect(out.match(/v2-pill-gain/g)).toHaveLength(1);
    expect(out).toContain('data-worst="true"');
  });

  it('printedTakeaway leaves out rows with no number and says nothing with none left', () => {
    const model = engineModel();
    const rows = [
      ...model.rows,
      [
        { text: 'M-99', sort: '—' },
        { text: '—', sort: '—' },
      ],
    ];
    const line = printedTakeaway({ rows, meaning: model.meaning }, say);
    expect(line).not.toBeNull();
    expect(
      printedTakeaway(
        {
          rows: [
            [
              { text: 'M-99', sort: '' },
              { text: '—', sort: '' },
            ],
          ],
          meaning: model.meaning,
        },
        say,
      ),
    ).toBeNull();
  });

  it('a printed table with a measure opens with its takeaway and ranks worst first', () => {
    const model = engineModel();
    const out = renderToStaticMarkup(
      h(PrintedDataTable, {
        table: {
          title: model.title,
          header: model.header,
          rows: model.rows.map((cells) => cells.map((c) => ({ ...c, chips: [] }))),
          chips: [],
          meaning: model.meaning,
        },
        words: WORDS,
      }),
    );
    expect(out).toContain('3 of 10 miss 20.0 h; worst is M-02 (40.0 h).');
    expect(out.indexOf('>M-02<')).toBeLessThan(out.indexOf('>M-04<'));
  });
});
