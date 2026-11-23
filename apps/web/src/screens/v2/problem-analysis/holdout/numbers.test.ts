// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../../i18n/index.js';
import { answerKey, testT } from '../../printed-page/test-support.js';
import { problemAnalysisModel } from '../adapter.js';
import { ProblemAnalysisView } from '../View.js';

/** G1.4, hidden: each chart's numbers sit in its own card, and all of them come before the first table. */
const model = problemAnalysisModel(answerKey('a10-problems', 'a10-problems', 41), testT)!;
const nav = [{ id: 'm', label: 'Machines', icon: 'machines' as const, href: '/a', current: true }];
const markup = renderToStaticMarkup(
  createElement(MemoryRouter, {}, createElement(ProblemAnalysisView, { model, nav, title: 'T' })),
);
const SUMMARY = /<summary[^>]*>Show the numbers<\/summary>/g;

describe('Problem Analysis numbers, hidden', () => {
  it('puts one "Show the numbers" inside each chart card, the bar chart and the scatter alike', () => {
    expect(model.charts.map((chart) => chart.spec.kind)).toEqual(['bar', 'scatter']);
    for (const chart of model.charts) {
      const start = markup.indexOf(`aria-label="${chart.spec.title}"`);
      expect(start, chart.id).toBeGreaterThan(0);
      const card = markup.slice(start, markup.indexOf('</section>', start));
      expect(card.match(SUMMARY), chart.id).toHaveLength(1);
    }
  });

  it('keeps every "Show the numbers" before the first table and none on the what-if figures', () => {
    const summaries = [...markup.matchAll(SUMMARY)];
    expect(summaries).toHaveLength(2);
    const firstTable = markup.indexOf('>All problem groups<');
    expect(firstTable).toBeGreaterThan(0);
    expect(summaries.at(-1)!.index).toBeLessThan(firstTable);
    const firstChart = markup.indexOf(`aria-label="${model.charts[0]!.spec.title}"`);
    expect(summaries[0]!.index).toBeGreaterThan(firstChart);
  });
});
