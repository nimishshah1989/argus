// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { realT } from '../printed-page/test-support.js';
import { logFromFigures, printedLog } from './live.js';
import { EMPTY_QUERY, type LogQuery } from './model.js';
import { workbookLog } from './source.js';
import { BreakdownLogView } from './View.js';

/** The old export prop and the sweep's sheets (706) together, so this draws before and after the Excel swap. */
const exportProps = { onExport: () => Promise.resolve(), sheets: [] };
const draw = (shown: NonNullable<ReturnType<typeof logFromFigures>>) =>
  renderToStaticMarkup(
    h(
      QueryClientProvider,
      { client: new QueryClient() },
      h(
        MemoryRouter,
        null,
        h(BreakdownLogView, {
          model: shown,
          nav: [],
          title: 'Breakdown log',
          onQuery: () => {},
          ...exportProps,
        }),
      ),
    ),
  );
const model = logFromFigures(workbookLog, EMPTY_QUERY, realT)!;
const markup = draw(model);
const asked = (query: Partial<LogQuery>) =>
  draw(logFromFigures(workbookLog, { ...EMPTY_QUERY, ...query }, realT)!);

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

  it('offers a Month filter (with its year) and a Team member filter beside Date, Shift, Machine and Code', () => {
    for (const label of ['Date', 'Month', 'Shift', 'Machine', 'Code', 'Team member'])
      expect(markup).toContain(`aria-label="${label}"`);
    const [newest] = model.options.month;
    const [year, month] = newest!.split('-');
    const names = [
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
      `<option value="${newest}">${names[Number(month) - 1]} ${year}</option>`,
    );
    expect(markup).toContain(`<option value="${model.options.person[0]}">`);
  });

  it('reads a code with what it means in the Code filter, and its badge says it too', () => {
    expect(markup).toContain('<option value="E">E — Electronics/Electrical</option>');
    const row = asked({ filters: { ...EMPTY_QUERY.filters, code: 'E' } });
    expect(row).toContain('title="E: Electronics/Electrical"');
    expect(row).toContain('<span class="v2-sr">: Electronics/Electrical</span>');
  });

  it('tags a stop over 4 hours with an icon and a word, never by colour alone, and leaves the calm ones plain', () => {
    const long = asked({ sort: { key: 'hours', dir: 'desc' } });
    expect(long).toMatch(
      /v2-pill v2-pill-loss"><svg[^>]*aria-hidden="true"[^>]*>.*?<\/svg>Over 4 h/,
    );
    const calm = asked({ sort: { key: 'hours', dir: 'asc' } });
    expect(calm).not.toContain('Over 4 h');
    expect(calm).not.toContain('Over 1 h');
  });

  it('makes PM its own planned-work tag with the wrench', () => {
    const pm = asked({ filters: { ...EMPTY_QUERY.filters, code: 'PM' } });
    expect(pm).toMatch(/v2-pill v2-pill-plan"><svg.*?<\/svg>PM/);
  });

  it('says who supported a job under who did it', () => {
    const supporter = printedLog(workbookLog, realT)!
      .detail.find((d) => d.supportedBy !== '')!
      .supportedBy.split(',')[0]!
      .trim();
    const out = asked({ filters: { ...EMPTY_QUERY.filters, person: supporter } });
    expect(out).toContain('Supported by');
  });
});
