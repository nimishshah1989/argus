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

/**
 * Ticket 615, M2b (ADR 0023): the Breakdown Log says what to notice. The first page of the 11 November workbook is ten
 * entries: 1357 (1.83 h), 1356 (0.58), 1355 (1.32), 1354 (0.48), 1353 (no downtime), 1352 (1), 1351 and 1350 (no
 * downtime), 1349 (0.42), 1348 (1.55). Three ran over an hour; none over four.
 */
const model = logFromFigures(workbookLog, EMPTY_QUERY, realT)!;
const byNo = (no: string) => model.rows.find((r) => r.srNo === no)!;

describe('Breakdown Log insight', () => {
  it('opens the table with a takeaway that counts the stops over an hour and names the longest', () => {
    expect(model.takeaways).toEqual({
      log: {
        text: '3 of 10 entries on this page ran over 1 hour; the longest, 1.83 h, was on VC-15.',
        tone: 'risk',
        tag: 'Risk',
        outlier: '1357',
      },
    });
  });

  it('marks the stops over an hour, as before, and only those', () => {
    const flagged = model.rows.filter((r) => r.severity !== null).map((r) => [r.srNo, r.severity]);
    expect(flagged).toEqual([
      ['1357', 'watch'],
      ['1355', 'watch'],
      ['1348', 'watch'],
    ]);
  });

  it("gives each entry's hours a yardstick: its share of the longest on the page", () => {
    expect(byNo('1357').share).toBe(1);
    expect(byNo('1355').share).toBe(0.72);
    expect(byNo('1348').share).toBe(0.85);
    expect(byNo('1356').share).toBe(0.32);
    expect(byNo('1353').share).toBeNull();
  });

  it('draws the takeaway, with the risk pill, above the table', () => {
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
    expect(markup).toContain('class="v2-takeaway"');
    expect(markup).toContain('the longest, 1.83 h, was on VC-15.');
    expect(markup).toContain('v2-pill-risk');
  });
});
