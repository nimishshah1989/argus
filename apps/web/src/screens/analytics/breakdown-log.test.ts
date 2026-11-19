import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { FiguresReply } from '@uptimo/shared/analytics';
import '../../i18n/index.js';
import { BreakdownLog } from './BreakdownLog.js';

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

const page = (figure: Figure) =>
  renderToStaticMarkup(
    h(
      MemoryRouter,
      { initialEntries: ['/analytics/breakdowns'] },
      h(BreakdownLog, { figure, menu: null, asOf: '2026-11-11', drill: null }),
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
