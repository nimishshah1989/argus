// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../i18n/index.js';
import { fixFinderModel } from './fix-finder/adapter.js';
import { FixFinderView } from './fix-finder/View.js';
import { problemAnalysisModel } from './problem-analysis/adapter.js';
import { ProblemAnalysisView } from './problem-analysis/View.js';
import { answerKey, testT } from './printed-page/test-support.js';

/**
 * The order of a screen's headings and table columns, as the live screen draws them from the engine's answer key. It
 * stands where the v1 gallery list (`analytics-order-data.ts`) stood for these two screens: a restyle that reorders,
 * adds or drops a section or a column fails here.
 */
const nav = [{ id: 'm', label: 'Machines', icon: 'machines' as const, href: '/a', current: true }];

const outline = (markup: string): string[] =>
  [...markup.matchAll(/<(h1|h2|th)\b[^>]*>(.*?)<\/\1>/gs)]
    .map(
      (found) =>
        `${found[1]}: ${found[2]!
          .replace(/<[^>]+>/g, '')
          .replace(/ \(.*\)$/, '')
          .trim()}`,
    )
    .filter((line) => !line.endsWith(': '));

const draw = (view: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(MemoryRouter, {}, view));

describe('Problem Analysis draws its sections and columns in order', () => {
  const model = problemAnalysisModel(answerKey('a10-problems', 'a10-problems', 41), testT)!;
  const lines = outline(draw(createElement(ProblemAnalysisView, { model, nav, title: 'Title' })));

  it('puts the two charts and the what-if before the tables, and the tables in the engine order', () => {
    const sections = lines.filter((line) => line.startsWith('h2: ') && line !== 'h2: ');
    expect(sections.slice(-6)).toEqual([
      'h2: All problem groups',
      'h2: Families of problems',
      'h2: Repeat offenders',
      'h2: Entries the system could not place',
      'h2: Words not yet recognised',
      'h2: Problem groups',
    ]);
    expect(sections.indexOf('h2: Which problems cost the most?')).toBeLessThan(
      sections.indexOf('h2: All problem groups'),
    );
  });

  it('draws the eight figures in the engine order, and the group editor’s columns last', () => {
    const markup = draw(createElement(ProblemAnalysisView, { model, nav, title: 'Title' }));
    const at = [...model.studied, ...model.whatIf].map((figure) =>
      markup.indexOf(`aria-label="${figure.label}"`),
    );
    expect(at.every((place) => place > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    const editor = lines.slice(lines.lastIndexOf('h2: Problem groups') + 1);
    expect(editor.filter((line) => line.startsWith('th: '))).toEqual([
      'th: Order',
      'th: Keywords',
      'th: Remove',
    ]);
  });

  it('keeps each table’s columns in the engine order', () => {
    const columns = (after: string, before: string) =>
      lines.slice(lines.indexOf(after) + 1, lines.indexOf(before)).map((line) => line.slice(4));
    expect(columns('h2: All problem groups', 'h2: Families of problems')).toEqual([
      'Problem group',
      'Family',
      'Breakdowns',
      '% of breakdowns',
      'Hours',
      '% of hours',
      'Hrs each',
      'Machines',
      'Quick',
    ]);
    expect(
      columns('h2: Entries the system could not place', 'h2: Words not yet recognised'),
    ).toEqual(['Date', 'Machine', 'Problem', 'Action taken', 'Group', 'Accept']);
  });
});

describe('Fix Finder draws its table and filters in order', () => {
  const model = fixFinderModel(answerKey('fix-finder', 'fix-finder', 43), testT)!;
  const markup = draw(createElement(FixFinderView, { model, nav, title: 'Title' }));

  it('lists the case columns in the engine order', () => {
    expect(outline(markup).filter((line) => line.startsWith('th: '))).toEqual([
      'th: Match',
      'th: Date',
      'th: Machine',
      'th: Problem',
      'th: What was done',
      'th: Down',
      'th: Done by',
    ]);
  });

  it('offers the match filter as All, 100% match, Part match', () => {
    const at = ['>All<', '>100% match<', '>Part match<'].map((chip) => markup.indexOf(chip));
    expect(at.every((place) => place > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });
});
