// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DataTable, type TableLabels } from './data-table.js';
import { Disclosure } from './disclosure.js';
import * as elements from './index.js';
import { KpiTile } from './kpi-tile.js';
import { StatusChip } from './status-chip.js';
import { nextSort, type Column } from './table-model.js';

const html = (element: ReactElement) => renderToStaticMarkup(element);

interface Row {
  id: number;
  name: string;
  hours: number;
  note: string;
}
const ROWS: Row[] = [
  { id: 1, name: 'Press 1', hours: 4.5, note: 'ok' },
  { id: 2, name: 'Press 2', hours: 2, note: 'ok' },
];
const COLUMNS: Column<Row>[] = [
  { id: 'name', header: 'Machine', cell: (r) => r.name, sortValue: (r) => r.name },
  { id: 'hours', header: 'Hours', cell: (r) => r.hours, numeric: true, sortValue: (r) => r.hours },
  { id: 'note', header: 'Note', cell: (r) => r.note, align: 'center', sortValue: (r) => r.note },
  { id: 'tail', header: 'Tail', cell: (r) => r.id, align: 'right' },
];
const LABELS: TableLabels = {
  caption: 'Short list',
  filter: 'Filter',
  previous: 'Previous',
  next: 'Next',
  page: (p, n) => `Page ${p} of ${n}`,
  range: (a, b, n) => `${a} to ${b} of ${n}`,
  empty: 'No rows',
};
const table = (over: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) =>
  html(
    createElement(DataTable<Row>, {
      columns: COLUMNS,
      rows: ROWS,
      rowKey: (r) => String(r.id),
      total: ROWS.length,
      page: 0,
      pageSize: 25,
      labels: LABELS,
      onSort: () => {},
      onPage: () => {},
      ...over,
    }),
  );

describe('KPI tile with a word for a value', () => {
  it('prints the word as given, with no count-up and no unit', () => {
    const out = html(createElement(KpiTile, { label: 'Trend', value: 'Stable' }));
    expect(out).toContain('Trend');
    expect(out).toContain('Stable');
    expect(out).not.toContain('NaN');
  });

  it('still prints a dash for none and a number through its format', () => {
    expect(html(createElement(KpiTile, { label: 'A', value: null }))).toContain('—');
    const out = html(createElement(KpiTile, { label: 'A', value: 3, format: (n) => `${n} hrs` }));
    expect(out).toContain('3 hrs');
  });

  it('lets a word share the tile with a verdict chip and a unit', () => {
    const out = html(
      createElement(KpiTile, { label: 'Mood', value: 'Calm', tone: 'good', verdict: 'On target' }),
    );
    expect(out).toContain('Calm');
    expect(out).toContain('On target');
  });
});

describe('data table: pager and alignment', () => {
  it('keeps the pager by default and drops it on request when every row fits', () => {
    expect(table()).toContain('Page 1 of 1');
    const hidden = table({ hidePagerWhenFits: true });
    expect(hidden).not.toContain('Page 1 of 1');
    expect(hidden).not.toContain('Next');
    expect(hidden).toContain('Press 2');
  });

  it('keeps the pager when the rows do not fit on one page, even when asked to hide it', () => {
    const out = table({ hidePagerWhenFits: true, total: 90, pageSize: 25 });
    expect(out).toContain('Page 1 of 4');
  });

  it('aligns each column as asked: numbers right by default, a word left, a chosen side wins', () => {
    const out = table();
    const header = (name: string) =>
      new RegExp(
        `<th[^>]*class="[^"]*text-(left|right|center)[^"]*"[^>]*>(?:(?!</th>).)*${name}`,
      ).exec(out)?.[1];
    expect(header('Machine')).toBe('left');
    expect(header('Hours')).toBe('right');
    expect(header('Note')).toBe('center');
    expect(header('Tail')).toBe('right');
    const cell = (text: string) =>
      new RegExp(`<td[^>]*class="([^"]*)"[^>]*>${text}</td>`).exec(out)?.[1];
    expect(cell('Press 1')).toContain('text-left');
    expect(cell('4.5')).toContain('text-right');
    expect(cell('4.5')).toContain('tabular-nums');
    expect(cell('ok')).toContain('text-center');
  });
});

describe('next sort, from the elements door', () => {
  it('goes ascending, descending, then back to the given order', () => {
    expect(elements.nextSort).toBe(nextSort);
    const first = elements.nextSort(undefined, 'hours');
    expect(first).toEqual({ column: 'hours', dir: 'asc' });
    const second = elements.nextSort(first, 'hours');
    expect(second).toEqual({ column: 'hours', dir: 'desc' });
    expect(elements.nextSort(second, 'hours')).toBeUndefined();
  });
});

describe('disclosure', () => {
  const draw = (open: boolean) =>
    html(
      createElement(Disclosure, {
        label: 'Show details',
        defaultOpen: open,
        children: 'The details',
      }),
    );

  it('is a button whose aria-expanded says closed, and its region is hidden', () => {
    const out = draw(false);
    expect(out).toMatch(/<button[^>]*type="button"[^>]*aria-expanded="false"/);
    expect(out).toContain('Show details');
    expect(out).toMatch(/<div[^>]*role="region"[^>]*hidden/);
  });

  it('says open, shows the region and names it by the button', () => {
    const out = draw(true);
    expect(out).toContain('aria-expanded="true"');
    expect(out).not.toMatch(/role="region"[^>]*hidden/);
    const controls = /aria-controls="([^"]+)"/.exec(out)?.[1];
    const labelled = /aria-labelledby="([^"]+)"/.exec(out)?.[1];
    expect(out).toContain(`id="${controls}"`);
    expect(out).toContain(`id="${labelled}"`);
    expect(out).toContain('The details');
  });

  it('is a 44 px target and a real button, so Enter and Space work with no script', () => {
    expect(draw(false)).toContain('min-h-target-min min-w-target-min');
  });

  it('turns its chevron and fades its region only when motion is allowed', () => {
    const css = readFileSync(new URL('./elements.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.el-chevron\s*\{[^}]*transition:/);
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(/\.el-chevron\s*[,{]/);
    expect(reduced).toContain('transition: none');
    expect(reduced).toContain('.el-fade');
    expect(draw(true)).toContain('el-fade');
  });
});

describe('status chip, info tone', () => {
  it('prints a blue chip with the info icon and its word, and leaves the four tones as they were', () => {
    const info = html(createElement(StatusChip, { tone: 'info', children: 'Planned' }));
    expect(info).toContain('data-tone="info"');
    expect(info).toContain('bg-info-tint text-info-ink');
    expect(info).toContain('Planned');
    expect(info).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(html(createElement(StatusChip, { tone: 'good', children: 'Fine' }))).toContain(
      'bg-good-tint',
    );
  });

  it('draws a different icon from the neutral chip, so the blue is never the only signal', () => {
    const shape = (tone: 'info' | 'neutral') =>
      /<svg[^>]*class="([^"]*)"/.exec(
        html(createElement(StatusChip, { tone, children: 'x' })),
      )?.[1];
    expect(shape('info')).not.toBe(shape('neutral'));
  });
});
