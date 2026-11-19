import { createElement as h, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { FiguresReply } from '@uptimo/shared/analytics';
import '../../i18n/index.js';
import { BreakdownLog } from './BreakdownLog.js';
import { DrillTable } from './DrillTable.js';
import { groupFor } from './groups.js';

type Figure = FiguresReply['figures'][number];

const HEADER = ['', 'Sr No', 'Ticket No.', 'Date', 'Shift', 'Machine', 'Problem', 'Done By'].concat(
  ['Downtime (Hrs)', 'Code'],
);
const TOTAL = 1343;

/** A log as the engine writes it: newest first, the highest Sr No at the head, a dash for a NO DT row. */
function logFigure(count: number): Figure {
  const rows = Array.from({ length: count }, (_, at) => {
    const srNo = count - at;
    return [
      '👁',
      String(srNo),
      `BD-${String(srNo).padStart(4, '0')}`,
      '07-11-2026',
      '2',
      `VC-${(srNo % 40) + 1}`,
      `Problem ${srNo}`,
      'Person 41',
      srNo % 7 === 0 ? '—' : `${srNo % 5}.${(srNo % 9) + 1}`,
      'ATC',
    ];
  });
  return {
    key: 'breakdown-log',
    screen: 'breakdown-log',
    owner: 40,
    status: 'ready',
    value: {
      screen: 'breakdown-log',
      asOf: '2026-11-11',
      pages: [
        {
          page: 'breakdowns',
          title: 'Breakdown Log',
          kpis: [],
          tables: [{ title: '', header: HEADER, rows, rowCount: rows.length, truncated: true }],
          charts: [],
        },
      ],
    },
    drill: { type: 'ticket', ids: rows.map((_, at) => `id-${at}`) },
  } as Figure;
}

const page = (figure: Figure, drill: ReactNode = null) =>
  renderToStaticMarkup(
    h(
      MemoryRouter,
      { initialEntries: ['/analytics/breakdowns'] },
      h(BreakdownLog, { figure, menu: null, asOf: '2026-11-11', drill }),
    ),
  );

const bodyRows = (html: string) => (html.split('<tbody')[1]?.match(/<tr[ >]/g) ?? []).length;

describe('the Breakdown Log opens on one page of rows', () => {
  const html = page(logFigure(TOTAL));

  it('paints 50 of the 1,343 rows, never all of them', () => {
    expect(bodyRows(html)).toBe(50);
  });

  it('prints the whole count and which rows are on the page', () => {
    expect(html).toContain('1,343 rows');
    expect(html).toContain('1 to 50 of 1,343');
  });

  it('keeps the engine row numbers and values: the newest first, a dash where there is no downtime', () => {
    expect(html).toContain('>1343<');
    expect(html).toContain('>1294<');
    expect(html).not.toContain('>1293<');
    expect(html).toContain('>—<');
  });

  it('has one heading for the screen and the way to each ticket named by its row number', () => {
    expect(html.match(/<h2/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Open the ticket for Sr No 1343"');
  });

  it('paints a short log whole', () => {
    expect(bodyRows(page(logFigure(12)))).toBe(12);
  });
});

const DROWS = h('p', null, 'DRILL ROWS');

describe('a drill opened on the log', () => {
  it('sits in the template drill area under one h2 for the screen', () => {
    const html = page(logFigure(12), DROWS);
    expect(html.match(/<h2/g)).toHaveLength(1);
    expect(html).toMatch(/<h3[^>]*>The rows behind this figure<\/h3>/);
    expect(html).toContain('DRILL ROWS');
  });

  it('still shows its rows when the log is not computed or has no entries', () => {
    const missing = page(
      { ...logFigure(12), status: 'not_computed', value: null } as Figure,
      DROWS,
    );
    expect(missing).toContain('Not computed yet');
    expect(missing).toContain('DRILL ROWS');
    const empty = page(logFigure(0), DROWS);
    expect(empty).toContain('No breakdown log entries yet.');
    expect(empty).toContain('DRILL ROWS');
  });

  it('the shared drill table adds no heading of its own inside the template area', () => {
    const group = groupFor('breakdowns');
    expect(group).toBeDefined();
    const html = renderToStaticMarkup(
      h(
        QueryClientProvider,
        { client: new QueryClient() },
        h(
          MemoryRouter,
          null,
          h(DrillTable, { bare: true, group: group!, drill: { type: 'ticket', ids: ['a'] } }),
        ),
      ),
    );
    expect(html).not.toContain('<h2');
  });
});
