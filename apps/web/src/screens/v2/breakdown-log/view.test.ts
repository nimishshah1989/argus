// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { realT } from '../printed-page/test-support.js';
import { logFromFigures } from './live.js';
import { EMPTY_QUERY } from './model.js';
import { workbookLog } from './source.js';
import { BreakdownLogView } from './View.js';

const model = logFromFigures(workbookLog, EMPTY_QUERY, realT)!;
const markup = renderToStaticMarkup(
  h(
    QueryClientProvider,
    { client: new QueryClient() },
    h(
      MemoryRouter,
      null,
      h(BreakdownLogView, {
        model,
        nav: [],
        title: 'Breakdown log',
        onQuery: () => {},
        onExport: () => Promise.resolve(),
      }),
    ),
  ),
);

describe('the Breakdown Log as the reader sees it', () => {
  it('reads each date filter option the way the column prints it, and filters by the day the engine printed', () => {
    const printed = model.options.date[0]!;
    expect(printed).toMatch(/^\d{2}-\d{2}-\d{4}$/);
    const [d, m, y] = printed.split('-');
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    expect(markup).toContain(
      `<option value="${printed}">${d}-${months[Number(m) - 1]}-${y}</option>`,
    );
    // The other filters keep the engine's own text for value and label.
    const shift = model.options.shift[0]!;
    expect(markup).toContain(`<option value="${shift}">${shift}</option>`);
  });

  it('opens a row’s own ticket through the router, not by reloading the app', () => {
    const row = model.rows.find((one) => one.ticketId !== null)!;
    expect(markup).toContain(`href="/desk/${encodeURIComponent(row.ticketId!)}"`);
    expect(markup).toContain(`Open the ticket for Sr No ${row.srNo}`);
  });
});
