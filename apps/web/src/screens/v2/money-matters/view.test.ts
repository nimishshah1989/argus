// @vitest-environment node
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { pageWords } from '../printed-page/words.js';
import { printedTable } from '../printed-page/table.js';
import { realT } from '../printed-page/test-support.js';
import type { MoneyMattersModel, MoneyPage } from './model.js';
import { MoneyMattersView } from './View.js';

/**
 * S22's View (ADR 0034: one render-smoke, plus money): a page model draws every tile, both tables, the verdict and each
 * section's takeaway; the refusal draws none of the page's figures and no rupee at all.
 */
const tile = (id: string, label: string, value: string, yardstick: string) => ({
  id,
  label,
  value,
  sub: 'sub ' + id,
  yardstick,
});
const takeaway = (text: string) => ({ text, tone: 'risk' as const, tag: 'Risk' });
const page: MoneyPage = {
  refused: false,
  verdict: { headline: [{ text: 'Breakdowns cost ₹ 11.11 lakh.' }], why: [], context: 'ctx' },
  groups: [
    {
      id: 'cost',
      title: 'What breakdowns cost',
      figures: [tile('a', 'Money lost', '₹ 11.11 lakh', '81% of ₹ 13.13 lakh')],
    },
    {
      id: 'next',
      title: 'Next month',
      figures: [tile('b', 'Next month, expected', '₹ 2.22 lakh', '+7% vs the average month')],
    },
    {
      id: 'price',
      title: 'The price of an hour',
      figures: [tile('c', 'Throughput', '₹ 1,801', 'Same on all 99 machines')],
    },
  ],
  chart: null,
  tables: [
    printedTable({
      title: 'Where the money could have been more',
      header: ['Lever', 'Money per year'],
      rows: [['Lever one', '₹ 3.33 lakh']],
      rowCount: 1,
      truncated: false,
    }),
    printedTable({
      title: 'Where the money was lost',
      header: ['Problem', 'Money (period)'],
      rows: [
        ['Problem one', '₹ 4.44 lakh'],
        ['Problem two', '₹ 5.55 lakh'],
      ],
      rowCount: 2,
      truncated: false,
    }),
  ],
  takeaways: {
    levers: takeaway('Lever one is 61% of the four.'),
    chart: null,
    lost: takeaway('1 of 2 make up 62% of the total.'),
  },
  source: 'Records to 11-Nov-2026.',
  words: pageWords(realT, 'v2mm.source'),
};

const draw = (model: MoneyMattersModel) =>
  renderToStaticMarkup(
    h(
      QueryClientProvider,
      { client: new QueryClient() },
      h(MemoryRouter, null, h(MoneyMattersView, { model, nav: [], title: 'Money Matters' })),
    ),
  );

const FIGURES = [
  '₹ 11.11 lakh',
  '₹ 2.22 lakh',
  '₹ 1,801',
  '₹ 3.33 lakh',
  '₹ 4.44 lakh',
  '₹ 5.55 lakh',
];

describe('S22 Money Matters as the reader sees it', () => {
  it('draws every tile with its yardstick, both tables and each takeaway', () => {
    const markup = draw(page);
    for (const figure of [...FIGURES, '81%', '+7%', '99', 'Lever one', 'Problem two'])
      expect(markup).toContain(figure);
    for (const figure of ['61%', '62%']) expect(markup).toContain(figure);
  });

  it('draws the refusal for a login without money rights, with no figure and no rupee', () => {
    const markup = draw({
      refused: true,
      title: 'Money Matters is for heads and admin',
      body: 'Ask a head.',
    });
    expect(markup).toContain('Money Matters is for heads and admin');
    expect(markup).not.toContain('₹');
  });
});
