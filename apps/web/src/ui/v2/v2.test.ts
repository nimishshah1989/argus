// @vitest-environment node
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { dashboardFixture as model } from '../../screens/v2/dashboard/fixture.js';
import { BulletBar, place } from './bullet-bar.js';
import { DataTable } from './data-table.js';
import { Drawer } from './drawer.js';
import { KpiCard } from './kpi-card.js';
import { Pareto, paretoMismatch } from './pareto.js';
import { SavedCopyNotice, ScreenStates } from './screen-states.js';
import { Points } from './points.js';
import { Shell } from './shell.js';
import { tablePage } from './table-model.js';
import { WhyToggle } from './why-toggle.js';

const html = (el: ReactElement) => renderToStaticMarkup(el);
const text = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const all = (markup: string, re: RegExp) => [...markup.matchAll(re)].map((m) => text(m[1]!));

describe('v2 rich text and Why', () => {
  it('reads as one sentence with the key number emphasised', () => {
    const out = html(
      createElement(Points, { points: [[{ text: 'Lost ' }, { text: '308 h', tone: 'loss' }]] }),
    );
    expect(text(out)).toBe('Lost 308 h');
    expect(all(out, /<b[^>]*>(.*?)<\/b>/g)).toEqual(['308 h']);
  });

  it('cannot carry markup of its own', () => {
    expect(
      html(createElement(Points, { points: [[{ text: '<img src=x>', tone: 'gain' }]] })),
    ).not.toContain('<img');
  });

  it('starts closed, and the region it controls is in the page but hidden', () => {
    const out = html(createElement(WhyToggle, { label: 'Why?', points: [[{ text: 'Hidden' }]] }));
    const controls = /aria-expanded="false" aria-controls="([^"]+)"/.exec(out)?.[1];
    expect(out).toMatch(new RegExp(`<div id="${controls}" hidden=""[^>]*>.*Hidden`));
  });
});

describe('v2 KPI card', () => {
  const kpi = model.kpis[0]!;
  const out = html(createElement(KpiCard, { kpi }));
  it('says the figure, its signed change against a stated period, what it means, and one line more', () => {
    for (const part of [
      kpi.label,
      kpi.value,
      `${kpi.delta.text} ${kpi.period}`,
      kpi.meaning,
      kpi.more,
    ])
      expect(text(out)).toContain(part.replace(/\u00a0/g, ' '));
  });
  it('is a named group a keyboard can reach, so the extra line shows on focus too', () => {
    expect(out).toMatch(new RegExp(`<section[^>]*tabindex="0"[^>]*aria-label="${kpi.label}"`));
  });
});

describe('v2 bullet bar', () => {
  const b = model.bullets[0]!;
  it('prints the figure as given, names the bar aloud, and opens from the whole row', () => {
    const out = html(createElement(BulletBar, { b }));
    expect(text(out)).toContain(`${b.label} ${b.shown}${b.unit} ${b.verdict}`);
    expect(out).toContain(`role="img" aria-label="${b.aria}"`);
    expect(out).toMatch(/<button type="button"[^>]*aria-expanded="false"/);
  });
  it('places marks on the scale, inside the bar, never dividing by an empty scale', () => {
    expect([place([0, 6])(3), place([0, 6])(9), place([0, 6])(-1), place([5, 5])(5)]).toEqual([
      '50.0%',
      '100.0%',
      '0.0%',
      '0.0%',
    ]);
  });
  it('marks a value past either end of the scale', () => {
    expect(html(createElement(BulletBar, { b: { ...b, value: 120 } }))).toContain(
      'data-clamp="over"',
    );
    expect(html(createElement(BulletBar, { b: { ...b, value: 90 } }))).toContain(
      'data-clamp="under"',
    );
  });
});

describe('v2 pareto', () => {
  const out = html(
    createElement(Pareto, { data: model.pareto, whyLabel: 'Why these 3?', actions: null }),
  );
  it('ends the running total at 100 %, on the 100 % tick', () => {
    const points = /<polyline points="([^"]+)"/.exec(out)![1]!.split(' ');
    const lastY = Number(points[points.length - 1]!.split(',')[1]);
    const tickY = Number(/<text x="\d+" y="([\d.]+)"[^>]*data-tick="100"/.exec(out)![1]) - 4;
    expect(lastY).toBeCloseTo(tickY, 5);
    expect(all(out, /<text[^>]*data-end="true"[^>]*>(.*?)<\/text>/g)).toEqual(['100%']);
  });
  it('says when the bars do not add up to the total', () => {
    expect(paretoMismatch(model.pareto)).toBeNull();
    expect(paretoMismatch({ ...model.pareto, total: 400 })).toMatch(/add up to 312.4/);
  });
});

describe('v2 table', () => {
  const rows = Array.from({ length: 23 }, (_, i) => ({ code: `M-${i + 1}`, hours: (i * 7) % 23 }));
  const q = { query: '', text: (r: { code: string }) => r.code, page: 1 };
  it('shows ten rows a page and says which of how many', () => {
    expect(tablePage(rows, q)).toMatchObject({ from: 1, to: 10, total: 23, pages: 3 });
    expect(tablePage(rows, { ...q, page: 9 })).toMatchObject({ page: 3, from: 21, to: 23 });
  });
  it('searches, filters and sorts before it pages', () => {
    const view = tablePage(rows, {
      ...q,
      query: 'm-1',
      filter: (r) => r.hours > 3,
      sortBy: (r) => r.hours,
      dir: 'desc',
    });
    expect(view.rows.map((r) => r.hours)).toEqual(
      [...view.rows.map((r) => r.hours)].sort((a, b) => b - a),
    );
    expect(view.rows.every((r) => r.code.startsWith('M-1') && r.hours > 3)).toBe(true);
  });
  const table = (
    filters: { key: string; label: string; test?: (r: { hours: number }) => boolean }[],
  ) =>
    html(
      createElement(DataTable<{ code: string; hours: number }>, {
        rows,
        rowKey: (r) => r.code,
        columns: [{ key: 'code', label: 'Code', cell: (r) => r.code, sortBy: (r) => r.code }],
        filters,
        text: (r) => r.code,
        words: {
          title: 'Machines',
          search: 'Search',
          showing: '{from}–{to} of {total}',
          noResults: 'Nothing matches',
          open: 'Open',
        },
        onOpen: () => {},
      }),
    );

  it('never paints more than ten rows, and sorts from a header button', () => {
    const out = table([{ key: 'all', label: 'All' }]);
    expect(out.match(/<tr /g)).toHaveLength(10);
    expect(text(out)).toContain('1–10 of 23');
    expect(text(out)).not.toContain('Nothing matches');
    expect(out).toMatch(/<button type="button" class="v2-sort"/);
  });

  it('says so, in a live region, when the chosen filter leaves no rows', () => {
    const out = table([{ key: 'none', label: 'None', test: () => false }]);
    expect(out.match(/<tbody[^>]*>(.*?)<\/tbody>/)?.[1]).toBe('');
    expect(out).toMatch(/<div role="status"><p[^>]*>Nothing matches<\/p><\/div>/);
    expect(text(out)).toContain('0–0 of 0');
  });
});

describe('v2 shell and drawer', () => {
  const nav = [
    { id: 'today', label: 'Today', icon: 'today' as const, href: '/a', current: true },
    { id: 'machines', label: 'Machines', icon: 'machines' as const, href: '/b' },
  ];
  it('marks the page you are on in the rail and titles the page once', () => {
    const out = html(createElement(Shell, { nav, title: 'Dashboard', children: 'x' }));
    expect(out).toMatch(/<a href="\/a" aria-current="page"/);
    expect(all(out, /<h1[^>]*>(.*?)<\/h1>/g)).toEqual(['Dashboard']);
    expect(out.match(/<main/g)).toHaveLength(1);
  });
  it('names the rail, offers the search only when it has pages to search, and shows the plant beside the title', () => {
    const bare = html(createElement(Shell, { nav, title: 'Dashboard', children: 'x' }));
    expect(bare).toMatch(/<nav class="v2-rail" aria-label="[^"]+"/);
    expect(bare).not.toMatch(/aria-haspopup="dialog"/);
    const search = [{ to: '/c', text: 'Reports', hint: 'Section', match: 'Reports' }];
    const out = html(
      createElement(Shell, { nav, title: 'Dashboard', plant: 'Plant 7', search, children: 'x' }),
    );
    expect(out).toMatch(
      /<button[^>]*aria-haspopup="dialog"[^>]*aria-keyshortcuts="Control\+K Meta\+K"/,
    );
    expect(all(out, /<p class="v2-plant">(.*?)<\/p>/g)).toEqual(['Plant 7']);
    expect(out).not.toContain('role="dialog"'); // the palette is closed until asked for
  });
  it('keeps a closed drawer out of reach, and gives an open one its name and a close button', () => {
    expect(html(createElement(Drawer, { drawer: null }))).toMatch(/<aside[^>]*inert=""/);
    const open = html(
      createElement(Drawer, { drawer: { label: 'VC-8', content: 'detail', onClose: () => {} } }),
    );
    expect(open).toMatch(/<aside[^>]*aria-label="VC-8"/);
    expect(open).not.toMatch(/inert/);
    expect(open).toMatch(/<button[^>]*aria-label="[^"]+"/);
  });
});

describe('v2 screen states', () => {
  const states = (state: Parameters<typeof ScreenStates>[0]['loaded']['state']) =>
    html(
      createElement(ScreenStates<string>, {
        loaded: { state, retry: () => {} },
        children: () => null,
      }),
    );
  it('says "not computed" in its own state, apart from an empty one', () => {
    expect(states('notComputed')).toMatch(/data-state="not-computed"/);
    expect(states('empty')).toMatch(/data-state="empty"/);
    expect(states('notComputed')).not.toBe(states('empty'));
  });
  it('shows a saved copy as one line the reader can hear', () => {
    const out = html(createElement(SavedCopyNotice, { text: 'You are offline.' }));
    expect(out).toMatch(/role="status"/);
    expect(text(out)).toBe('You are offline.');
  });
});
