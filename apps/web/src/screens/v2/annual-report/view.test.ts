// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { tidyGlued } from '../printed-page/page-model.js';
import { answerKey, keyPage, realT } from '../printed-page/test-support.js';
import { annualReportModel, FIGURE } from './adapter.js';
import { AnnualReportView } from './View.js';

/**
 * S24 Annual Report View, built as drawn (#765). Critical tests only (ADR 0034): what each drawn part shows and in what
 * order, measured on the frozen answer key (2026 to 11 November), never the wording or the styling.
 */
const reply = answerKey('annual-report', FIGURE, 42);
const page = keyPage(reply);
const render = () =>
  renderToStaticMarkup(
    h(
      QueryClientProvider,
      { client: new QueryClient() },
      h(
        MemoryRouter,
        null,
        h(AnnualReportView, { model: annualReportModel(reply, realT)!, nav: [], title: 'Annual' }),
      ),
    ),
  )
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&amp;', '&');

/** One drawn part, from its `data-section` to the next part's, without its takeaway line (which names figures first). */
const part = (html: string, id: string): string => {
  const from = html.indexOf(`data-section="${id}"`);
  expect(from, `no data-section="${id}"`).toBeGreaterThanOrEqual(0);
  const next = html.indexOf('data-section="', from + 1);
  return html
    .slice(from, next < 0 ? undefined : next)
    .replace(/<p class="v2-takeaway".*?<\/p>/s, '');
};

/** Each text first appears after the one before it. */
const inOrder = (html: string, texts: string[]) => {
  const at = texts.map((text) => html.indexOf(text));
  for (const [i, text] of texts.entries())
    expect(at[i], `${text} missing`).toBeGreaterThanOrEqual(0);
  expect(at, texts.join(' < ')).toEqual([...at].sort((a, b) => a - b));
};

const BAR = /v2-ranked-track|v2-cellbar/;
/** The engine's `ch-ry-pareto` labels on the answer key. */
const FIFTEEN =
  'TMC-2 TC-5 VC-28 TC-7 TC-13 HMC-2 VC-22 TC-3 WJ-01 TC-10 TMC-4 S-2 VC-8 VC-16 VC-9'.split(' ');

describe('S24 Annual Report View, as drawn', () => {
  it('opens with the year in one line: breakdowns, hours, the worst month and the costliest machine', () => {
    const { headline } = annualReportModel(reply, realT)!.verdict;
    const text = headline.map((s) => s.text).join('');
    for (const figure of [/1,?279/, /3,?060\.2/, /June/, /660\.4/, /TMC-2 SL30MC/, /10\.1%/])
      expect(text).toMatch(figure);
    expect(render()).toContain(headline[0]!.text);
  });

  it('draws the months as bars in calendar order, the partial month starred and the worst month marked', () => {
    const months = part(render(), 'months-chart');
    expect(months).toMatch(BAR);
    inOrder(months, ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov*']);
    for (const figure of ['660.4', '112', '51.1']) expect(months).toContain(figure);
    expect(months.match(/v2-pill-loss/g)?.length, 'one worst month').toBe(1);
    const marked = months.slice(0, months.indexOf('v2-pill-loss'));
    expect(marked.lastIndexOf('Jun')).toBeGreaterThan(marked.lastIndexOf('May'));
  });

  it('draws the fifteen costliest machines as five bars and a tail, with the running share of the year', () => {
    const machines = part(render(), 'machines-chart');
    expect(machines).toMatch(BAR);
    inOrder(machines, ['TMC-2', 'TC-5', 'VC-28', 'TC-7', 'TC-13', '791.6']);
    for (const figure of ['307.6', '10.1%', '25.1%', '54.8%']) expect(machines).toContain(figure);
    // The tail opens in place: none of the fifteen is lost.
    for (const label of FIFTEEN) expect(machines).toContain(label);
  });

  it('puts the worst month first in the month table and keeps the calendar under it', () => {
    inOrder(part(render(), 'months'), ['June', 'April', 'August', 'January']);
  });

  it('draws machine age as bars, the costliest band a machine first', () => {
    const age = part(render(), 'age');
    expect(age).toMatch(BAR);
    inOrder(age, ['20+ yrs', '104.7', '0-5 yrs']);
  });

  it('draws PM hours as bars in calendar order, the August peak among them', () => {
    const pm = part(render(), 'pm');
    expect(pm).toMatch(BAR);
    inOrder(pm, ['Jan', 'Feb', 'Mar', 'Aug', 'Nov']);
    expect(pm).toContain('386.0');
  });

  it('draws the machines added as a cell strip, a row per category and a cell per month', () => {
    const added = part(render(), 'added');
    expect(added).toContain('v2-heat');
    inOrder(added, ['Vertical Machining Center', 'Turning Center', 'Vertical Turning Lathe']);
  });

  it('keeps the blank commentary form', () => {
    const form = part(render(), 'commentary');
    for (const label of ['Management commentary and actions', 'Action', 'Owner', 'Due date'])
      expect(form).toContain(label);
  });

  it('shows every column the engine printed, and the first row of each table (nothing not built)', () => {
    const html = render();
    // Rows past the first are the model test's job (tables whole) and the kit's paging; dates are reformatted.
    const printed = page.tables
      .flatMap((t) => [...t.header, ...(t.rows[0] ?? [])])
      .map(tidyGlued)
      .filter((s) => s.trim() !== '' && !/^\d{2}-\d{2}-\d{4}$/.test(s));
    expect([...new Set(printed)].filter((s) => !html.includes(s))).toEqual([]);
  });
});
