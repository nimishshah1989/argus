import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { FiguresReply } from '@uptimo/shared/analytics';
import '../../i18n/index.js';
import { columnsOf } from './engine-table.js';
import { groupFor } from './groups.js';
import { MachineView } from './MachinePage.js';
import { machineRecord } from './machine-record.js';
import { moveSortKey } from './machine-summary.js';
import { MachineTiles } from './machine-tiles.js';

const DRILL = encodeURIComponent('machine:m1');
const NOT_AVAILABLE = 'Not available';
const H2 = /<h2/g;
const DRILL_TITLE = /<h3[^>]*>The rows behind this figure<\/h3>/;

const page = (url: string, element: ReactElement) =>
  renderToStaticMarkup(
    h(
      QueryClientProvider,
      { client: new QueryClient() },
      h(MemoryRouter, { initialEntries: [url] }, element),
    ),
  );

const group = groupFor('machines')!;

const machineFigures = (machine: unknown): FiguresReply =>
  ({
    asOf: '2026-11-11',
    figures: [
      {
        key: 'machine-page',
        screen: 'machine-page',
        owner: 39,
        status: 'ready',
        value: { byMachine: machine === null ? {} : { m1: machine } },
        drill: { type: 'machine', ids: [] },
      },
    ],
  }) as unknown as FiguresReply;

function machine(figures: FiguresReply): string {
  return page(
    `/analytics/machines/m1?drill=${DRILL}`,
    h(MachineView, { group, figures, id: 'm1' }),
  );
}

const FULL = {
  machine: { code: 'VC-1', category: 'Vertical Machining Center', powerKva: 21 },
  efficiencyPct: 20,
  breakdowns: { count: 3, hours: 4.5, mttr: 1.5 },
  pm: { visits: 1, hours: 2 },
  completeness: { recorded: 10, of: 10, missing: [] },
};

describe('a drill opened on the machine page', () => {
  it('shows its rows under one h2 for the machine', () => {
    const html = machine(machineFigures(FULL));
    expect(html.match(H2)).toHaveLength(1);
    expect(html).toMatch(DRILL_TITLE);
  });

  it('still shows its rows when the engine holds no record for the machine', () => {
    const html = machine(machineFigures(null));
    expect(html).toContain('The engine has no page for this machine yet.');
    expect(html).toMatch(DRILL_TITLE);
  });
});

/** The running-load tile only, cut out of the figures row. */
function runningLoad(raw: unknown): string {
  const record = machineRecord({ byMachine: { m1: raw } }, 'm1')!;
  const html = page('/', h(MachineTiles, { record, asOf: '2026-11-11', machineId: 'm1' }));
  const from = html.indexOf('data-figure="running-load"');
  return html.slice(from, html.indexOf('data-figure="breakdowns"'));
}

describe('the running-load tile', () => {
  it('says the efficiency factor when the engine gave one', () => {
    const tile = runningLoad(FULL);
    expect(tile).toContain('20% efficiency factor');
    expect(tile).not.toContain(NOT_AVAILABLE);
  });

  it('says "Not available" once, on the value, when there is no running load', () => {
    const tile = runningLoad({ machine: { code: 'VC-1' }, breakdowns: { count: 0 } });
    expect(tile.split(NOT_AVAILABLE)).toHaveLength(2);
  });

  it('says "Not available" once, as the efficiency line, when the load is known but its factor is not', () => {
    const record = machineRecord(
      { byMachine: { m1: { ...FULL, efficiencyPct: undefined, runningKva: 4.2 } } },
      'm1',
    )!;
    expect(record.runningKva).toBe(4.2);
    const html = page('/', h(MachineTiles, { record, asOf: '2026-11-11', machineId: 'm1' }));
    const tile = html.slice(
      html.indexOf('data-figure="running-load"'),
      html.indexOf('data-figure="breakdowns"'),
    );
    expect(tile.split(NOT_AVAILABLE)).toHaveLength(2);
  });
});

describe('the moves table date column', () => {
  it('sorts as a date, across months and years, not as DD-MM-YYYY text', () => {
    const columns = columnsOf(
      { caption: 'c', header: ['Date'], rows: [], sortKey: moveSortKey },
      new Set(),
    );
    const dates = ['05-01-2027', '28-12-2026', '03-08-2026', '31-12-2025'];
    const key = columns[0]!.sortValue!;
    const sorted = [...dates].sort((a, b) =>
      String(key({ row: [a], index: 0 })).localeCompare(String(key({ row: [b], index: 0 }))),
    );
    expect(sorted).toEqual(['31-12-2025', '03-08-2026', '28-12-2026', '05-01-2027']);
    expect(moveSortKey(1, '05-01-2027')).toBeUndefined();
  });
});
