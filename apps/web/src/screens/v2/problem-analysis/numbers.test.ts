// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { answerKey, testT } from '../printed-page/test-support.js';
import { problemAnalysisModel } from './adapter.js';
import { ProblemAnalysisView } from './View.js';

/** G1.4: both Problem Analysis charts open the numbers they plot behind their own "Show the numbers". */
const model = problemAnalysisModel(answerKey('a10-problems', 'a10-problems', 41), testT)!;
const nav = [{ id: 'm', label: 'Machines', icon: 'machines' as const, href: '/a', current: true }];
const markup = renderToStaticMarkup(
  createElement(MemoryRouter, {}, createElement(ProblemAnalysisView, { model, nav, title: 'T' })),
);

describe('Problem Analysis shows the numbers behind each chart', () => {
  it('gives each of its two charts its own "Show the numbers"', () => {
    const summaries = [...markup.matchAll(/<summary[^>]*>Show the numbers<\/summary>/g)];
    expect(model.charts).toHaveLength(2);
    expect(summaries).toHaveLength(model.charts.length);
  });
});
