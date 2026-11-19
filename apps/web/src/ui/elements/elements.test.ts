// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { formatFigure, type Measure } from '../meaning/index.js';
import { barShare, RankedList } from './ranked-list.js';
import { DataTable, type TableLabels } from './data-table.js';
import { DrillTrail } from './drill-trail.js';
import { GroupedNav } from './grouped-nav.js';
import { HeatGrid, heatLevel } from './heat-grid.js';
import { InsightBanner } from './insight-banner.js';
import { KpiTile } from './kpi-tile.js';
import { orderedRange, PeriodPicker } from './period-picker.js';
import { Sparkline, sparklinePoints } from './sparkline.js';
import { EmptyState, ErrorState, LoadingState } from './states.js';
import { StatusChip } from './status-chip.js';
import { MAX_PAGE_ROWS, nextSort, pageSizeOf, tableView, type Column } from './table-model.js';
import { Timeline } from './timeline.js';
import { TrendDelta } from './trend-delta.js';

const html = (element: ReactElement) => renderToStaticMarkup(element);
const routed = (element: ReactElement) =>
  html(createElement(MemoryRouter, { initialEntries: ['/a'] }, element));

const downIsGood: Measure = { unit: 'hours', better: 'down' };
const GUJARATI_40 = 'ક'.repeat(40);

describe('KPI tile', () => {
  it('prints the label, the value, a verdict word and how it moved', () => {
    const out = html(
      createElement(KpiTile, {
        label: 'Downtime',
        value: 12.5,
        format: (n: number) => formatFigure(downIsGood, n),
        tone: 'good',
        verdict: 'On target',
        change: { measure: downIsGood, delta: -3 },
        trend: { values: [5, 4, 3], label: 'Last 3 weeks' },
      }),
    );
    for (const text of ['Downtime', '12.5 hrs', 'On target', '-3 hrs', 'Better', 'Last 3 weeks'])
      expect(out).toContain(text);
  });

  it('keeps a 7-digit number and a 40-letter Gujarati label wrapping inside the tile', () => {
    const out = html(
      createElement(KpiTile, {
        label: GUJARATI_40,
        value: 1234567,
        format: (n: number) => formatFigure({ unit: 'money', better: 'neither' }, n),
      }),
    );
    expect(out).toContain(GUJARATI_40);
    expect(out).toContain('₹12,34,567');
    expect(out.match(/break-words/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe('status chip and trend delta', () => {
  it('always carries an icon and a word, never colour alone', () => {
    for (const tone of ['good', 'watch', 'bad', 'neutral'] as const) {
      const out = html(createElement(StatusChip, { tone, children: 'Word' }));
      expect(out).toContain('<svg');
      expect(out).toContain('Word');
    }
  });

  it('says a rise in a down-is-good figure is Worse, and a fall Better', () => {
    expect(html(createElement(TrendDelta, { measure: downIsGood, delta: 2 }))).toContain('Worse');
    expect(html(createElement(TrendDelta, { measure: downIsGood, delta: -2 }))).toContain('Better');
    expect(html(createElement(TrendDelta, { measure: downIsGood, delta: 0 }))).toContain(
      'No change',
    );
  });
});

describe('sparkline', () => {
  it('draws nothing for fewer than two values and a labelled image otherwise', () => {
    expect(html(createElement(Sparkline, { values: [3], label: 'x' }))).toBe('');
    const out = html(createElement(Sparkline, { values: [1, 2, 3], label: 'Rising' }));
    expect(out).toContain('role="img"');
    expect(out).toContain('aria-label="Rising"');
  });

  it('keeps every point inside the box, a flat series in the middle', () => {
    for (const [x, y] of sparklinePoints([4, 9, 1, 7])) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(96);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(28);
    }
    expect(sparklinePoints([5, 5, 5]).map(([, y]) => y)).toEqual([14, 14, 14]);
  });
});

describe('heat grid', () => {
  it('prints every number, shows a gap as a dash and shades by thirds of the range', () => {
    const out = html(
      createElement(HeatGrid, {
        label: 'Hours by cause',
        rows: ['Wear', 'Heat'],
        columns: ['Mon', 'Tue'],
        values: [
          [1, 5],
          [10, undefined],
        ],
        format: (v: number) => `${v} h`,
      }),
    );
    for (const text of ['1 h', '5 h', '10 h', '–', 'Wear', 'Tue']) expect(out).toContain(text);
    expect([
      heatLevel(0, 0, 9),
      heatLevel(4, 0, 9),
      heatLevel(9, 0, 9),
      heatLevel(3, 3, 3),
    ]).toEqual([0, 1, 2, 0]);
  });

  it('draws nothing for no rows', () => {
    const props = { label: 'x', rows: [], columns: ['a'], values: [], format: String };
    expect(html(createElement(HeatGrid, props))).toBe('');
  });

  it('keeps its ink readable (4.5:1) on every depth, in light and dark', () => {
    const css = readFileSync(new URL('../tokens.css', import.meta.url), 'utf8');
    const pair = (name: string): [string, string] => {
      const found = [...css.matchAll(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6});`, 'gi'))];
      return [found[0]![1]!, found[found.length - 1]![1]!];
    };
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi! + 0.05) / (lo! + 0.05);
    };
    const cases = [
      ['ramp-seq-1', 'neutral-900'],
      ['ramp-seq-2', 'neutral-900'],
      ['ramp-seq-5', 'surface'],
    ] as const;
    for (const theme of [0, 1])
      for (const [ramp, ink] of cases)
        expect(ratio(pair(ramp)[theme]!, pair(ink)[theme]!), `${ramp} ${theme}`).toBeGreaterThan(
          4.5,
        );
  });
});

describe('ranked list', () => {
  const items = [
    { id: 'a', label: 'Oil', value: 2, display: '2 hrs' },
    { id: 'b', label: 'Heat', value: 8, display: '8 hrs' },
    { id: 'c', label: 'Dust', value: 4, display: '4 hrs' },
  ];

  it('puts the largest first and sizes bars against it', () => {
    const out = html(createElement(RankedList, { items }));
    expect(out.indexOf('Heat')).toBeLessThan(out.indexOf('Dust'));
    expect(out.indexOf('Dust')).toBeLessThan(out.indexOf('Oil'));
    expect(out).toContain('width:100%');
    expect(out).toContain('width:25%');
    expect([barShare(5, 0), barShare(-1, 8), barShare(9, 8)]).toEqual([0, 0, 100]);
  });

  it('draws nothing for no items', () => {
    expect(html(createElement(RankedList, { items: [] }))).toBe('');
  });
});

describe('timeline and insight banner', () => {
  it('lists events in the order given, each with its time and title', () => {
    const out = html(
      createElement(Timeline, {
        label: 'History',
        events: [
          { id: '1', time: '05:02', title: 'Stopped', tone: 'bad' },
          { id: '2', time: '06:10', title: 'Fixed', detail: 'Belt', tone: 'good' },
        ],
      }),
    );
    expect(out.indexOf('Stopped')).toBeLessThan(out.indexOf('Fixed'));
    for (const text of ['05:02', '06:10', 'Belt', 'aria-label="History"'])
      expect(out).toContain(text);
    expect(out.match(/<svg/g)).toHaveLength(2);
  });

  it('announces a bad finding at once and others politely, always with an icon', () => {
    const bad = html(createElement(InsightBanner, { tone: 'bad', title: 'Three breakdowns' }));
    const good = html(createElement(InsightBanner, { tone: 'good', title: 'On target' }));
    expect(bad).toContain('role="alert"');
    expect(good).toContain('role="status"');
    expect(bad).toContain('<svg');
  });
});

describe('empty, loading and error states', () => {
  it('says what is missing, and offers the way to fill it', () => {
    const out = html(
      createElement(EmptyState, { title: 'No breakdowns', hint: 'Pick a longer period' }),
    );
    expect(out).toContain('No breakdowns');
    expect(out).toContain('Pick a longer period');
  });

  it('announces loading once and shows stand-ins', () => {
    const out = html(createElement(LoadingState, { label: 'Loading…', tiles: 2 }));
    expect(out).toContain('role="status"');
    expect(out.match(/aria-hidden/g)).toHaveLength(2);
  });

  it('alerts on an error and gives a retry button of 44 px or more', () => {
    const out = html(
      createElement(ErrorState, {
        title: 'Could not load',
        retryLabel: 'Try again',
        onRetry: () => {},
      }),
    );
    expect(out).toContain('role="alert"');
    expect(out).toContain('Try again');
    expect(out).toMatch(/min-h-target/);
  });
});

interface Row {
  id: number;
  name: string;
  hours: number;
}
const COLUMNS: Column<Row>[] = [
  { id: 'name', header: 'Machine', cell: (r) => r.name, sortValue: (r) => r.name },
  { id: 'hours', header: 'Hours', cell: (r) => r.hours, sortValue: (r) => r.hours, numeric: true },
];
const rows: Row[] = Array.from({ length: 1343 }, (_, id) => ({
  id,
  name: `Machine ${id + 1}`,
  hours: (id * 7) % 100,
}));
const text = (r: Row) => r.name;
const LABELS: TableLabels = {
  caption: 'Breakdown log',
  filter: 'Filter',
  previous: 'Previous',
  next: 'Next',
  page: (p, n) => `Page ${p} of ${n}`,
  range: (a, b, n) => `${a} to ${b} of ${n}`,
  empty: 'No rows match',
};

describe('data table model', () => {
  it('never paints more than 50 rows first, however large the list or the page size asked for', () => {
    expect(
      tableView(rows, COLUMNS, { filter: '', page: 0, pageSize: 500 }, text).rows,
    ).toHaveLength(MAX_PAGE_ROWS);
    expect(pageSizeOf(0)).toBe(1);
    expect(pageSizeOf(9999)).toBe(50);
  });

  it('pages through every row once and keeps the page in range', () => {
    const q = { filter: '', pageSize: 50 };
    const last = tableView(rows, COLUMNS, { ...q, page: 99 }, text);
    expect(last.pages).toBe(27);
    expect(last.page).toBe(26);
    expect(last.rows).toHaveLength(1343 - 26 * 50);
    expect(tableView(rows, COLUMNS, { ...q, page: -4 }, text).page).toBe(0);
  });

  it('sorts numbers as numbers and words with numbers inside in reading order', () => {
    const view = (sort: { column: string; dir: 'asc' | 'desc' }) =>
      tableView(rows, COLUMNS, { sort, filter: '', page: 0, pageSize: 3 }, text).rows;
    expect(view({ column: 'hours', dir: 'desc' }).map((r) => r.hours)).toEqual([99, 99, 99]);
    expect(view({ column: 'name', dir: 'asc' }).map((r) => r.name)).toEqual([
      'Machine 1',
      'Machine 2',
      'Machine 3',
    ]);
  });

  it('filters across all pages and reports the matching total', () => {
    const view = tableView(rows, COLUMNS, { filter: ' machine 13', page: 0, pageSize: 50 }, text);
    expect(view.total).toBe(55); // 13, 130 to 139, 1300 to 1343
    expect(view.rows.every((r) => r.name.includes('Machine 13'))).toBe(true);
  });

  it('cycles a header: ascending, descending, then the given order', () => {
    const asc = nextSort(undefined, 'hours');
    expect(asc).toEqual({ column: 'hours', dir: 'asc' });
    expect(nextSort(asc, 'hours')).toEqual({ column: 'hours', dir: 'desc' });
    expect(nextSort(nextSort(asc, 'hours'), 'hours')).toBeUndefined();
    expect(nextSort(asc, 'name')).toEqual({ column: 'name', dir: 'asc' });
  });
});

describe('data table', () => {
  const draw = (over: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) =>
    html(
      createElement(DataTable<Row>, {
        columns: COLUMNS,
        rows: rows.slice(0, 120), // a careless caller: the table still stops at 50
        rowKey: (r) => String(r.id),
        total: rows.length,
        page: 0,
        pageSize: 50,
        labels: LABELS,
        onSort: () => {},
        onPage: () => {},
        onFilter: () => {},
        ...over,
      }),
    );

  it('paints 50 rows, says which, and disables Previous on the first page', () => {
    const out = draw();
    expect(out.match(/<tr/g)).toHaveLength(51); // header + 50
    expect(out).toContain('1 to 50 of 1343');
    expect(out).toContain('Page 1 of 27');
    expect(out).toMatch(/<button[^>]*disabled[^>]*>Previous/);
  });

  it('marks the sorted column and gives sort buttons a 44 px tap target', () => {
    const out = draw({ sort: { column: 'hours', dir: 'desc' } });
    expect(out).toContain('aria-sort="descending"');
    expect(out).toContain('aria-sort="none"');
    expect(out).toMatch(/min-h-target-min/);
  });

  it('shows the empty line when no row matches', () => {
    const out = draw({ rows: [], total: 0 });
    expect(out).toContain('No rows match');
    expect(out).toContain('0 to 0 of 0');
  });
});

describe('period picker', () => {
  const periods = [
    { id: 'd7', label: '7 days' },
    { id: 'y', label: 'Year' },
  ];

  it('presses the chosen period and none when a date range is in use', () => {
    const on = html(
      createElement(PeriodPicker, { label: 'Period', periods, value: 'y', onChange: () => {} }),
    );
    expect(on).toMatch(/aria-pressed="true"[^>]*>Year/);
    expect(on).toMatch(/aria-pressed="false"[^>]*>7 days/);
    const own = html(
      createElement(PeriodPicker, {
        label: 'Period',
        periods,
        value: undefined,
        onChange: () => {},
      }),
    );
    expect(own).not.toContain('aria-pressed="true"');
  });

  it('puts a backwards range the right way round', () => {
    expect(orderedRange({ from: '2026-03-10', to: '2026-03-01' })).toEqual({
      from: '2026-03-01',
      to: '2026-03-10',
    });
    expect(orderedRange({ from: '2026-03-01', to: '' })).toEqual({ from: '2026-03-01', to: '' });
  });
});

describe('grouped navigation and drill trail', () => {
  it('marks the current screen under its heading', () => {
    const out = routed(
      createElement(GroupedNav, {
        label: 'Analytics',
        current: '/a',
        groups: [
          {
            id: 'g1',
            heading: 'Plant',
            items: [
              { to: '/a', label: 'Today' },
              { to: '/b', label: 'Month' },
            ],
          },
        ],
      }),
    );
    expect(out).toContain('Plant');
    expect(out).toMatch(/href="\/a"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/a"/);
    expect(out.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it('links every step back except the last, which is the current page', () => {
    const out = routed(
      createElement(DrillTrail, {
        label: 'You are here',
        steps: [{ label: 'Plant', to: '/' }, { label: 'Cell 4', to: '/c' }, { label: GUJARATI_40 }],
      }),
    );
    expect(out.match(/<a /g)).toHaveLength(2);
    expect(out).toContain(`aria-current="page"`);
    expect(out).toContain(GUJARATI_40);
    expect(html(createElement(DrillTrail, { label: 'x', steps: [] }))).toBe('');
  });
});

describe('motion', () => {
  const css = readFileSync(new URL('./elements.css', import.meta.url), 'utf8');

  it('switches every animation and the hover lift off under reduced motion', () => {
    const reduced = css.slice(css.indexOf('prefers-reduced-motion'));
    for (const name of ['el-pop', 'el-draw', 'el-fade', 'el-slide-in', 'el-lift'])
      expect(reduced, name).toContain(`.${name}`);
    expect(reduced).toContain('animation: none');
  });

  it('keeps every movement under a second and nothing looping', () => {
    expect(css).not.toContain('infinite');
    for (const [, ms] of css.matchAll(/animation:\s*el-\w+(?:-\w+)*\s+(\d+)ms/g))
      expect(Number(ms)).toBeLessThanOrEqual(800);
  });

  it('shows the final figure at once when it cannot animate (server render, reduced motion)', () => {
    const out = html(
      createElement(KpiTile, { label: 'x', value: 82.5, format: (n: number) => `${n}%` }),
    );
    expect(out).toContain('82.5%');
  });
});
