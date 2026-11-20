import type { TFunction } from 'i18next';
import type { ChartSpec } from '../../../ui/chart/use-chart.js';
import { fill } from '../../../i18n/fill.js';
import type { PageTable } from '../../analytics/page-content.js';
import type { FiguresPart, Page } from '../printed-page/printed.js';
import { figureOf, pageOf, shortDate } from '../printed-page/printed.js';
import { printedTable, type PrintedChip } from '../printed-page/table.js';
import type { Translate } from '../figures/read.js';
import { drillFor } from '../rows-behind/drill.js';
import type { ProblemAnalysisModel, ProblemAnalysisWords, ProblemChart } from './model.js';
import { problemAnalysisWords } from './words.js';

const KEY = 'a10-problems';
const PAGE_FIGURES = 4;
/** How many families the groups table offers as filter chips, in the engine's own order. */
const FAMILY_CHIPS = 3;
const SUGGESTION = /^Suggested: .+? \(\d+%\)/;
const CHOOSE = /^Choose group…|^No suggestion/;

/** The platform printed a drop-down as text: its chosen word and then every option, run together. Only the word stays. */
function tidyChoice(cell: string): string {
  return SUGGESTION.exec(cell)?.[0] ?? CHOOSE.exec(cell)?.[0] ?? cell;
}

const tidy = (table: PageTable, column: number): PageTable => ({
  ...table,
  rows: table.rows.map((row) => row.map((cell, at) => (at === column ? tidyChoice(cell) : cell))),
});

/** The platform printed no header over a button column; the screen names it. */
const named_ = (table: PageTable, column: number, label: string): PageTable => ({
  ...table,
  header: table.header.map((h, at) => (at === column && h.trim() === '' ? label : h)),
});

const named = (tables: PageTable[], first: string, ok: (t: PageTable) => boolean = () => true) =>
  tables.find((table) => table.header[0] === first && ok(table));

function familyChips(families: PageTable | undefined, all: string): PrintedChip[] {
  const names = (families?.rows ?? []).slice(0, FAMILY_CHIPS).map((row) => row[0] ?? '');
  return [
    { key: 'all', label: all },
    ...names.map((name) => ({ key: name, label: name, match: { column: 1, value: name } })),
  ];
}

function chartOf(spec: ChartSpec, words: ProblemAnalysisWords): ProblemChart {
  const scatter = spec.kind === 'scatter';
  const size = scatter ? spec.points.length : spec.kind === 'bar' ? spec.categories.length : 0;
  const text = scatter ? words.charts.scatter : words.charts.bar;
  return {
    id: spec.title,
    spec,
    sub: fill(text.sub, { n: size }),
    aria: fill(text.aria, { n: size }),
  };
}

function verdictOf(page: Page, words: ProblemAnalysisWords, source: string) {
  const [studied, top] = page.kpis;
  const known = studied !== undefined && top !== undefined;
  return {
    headline: [
      {
        text: known
          ? fill(words.headline, { top: top.value, share: top.sub ?? '' })
          : words.noFigures,
        tone: 'strong' as const,
      },
    ],
    why: page.kpis
      .slice(1, PAGE_FIGURES)
      .flatMap((kpi) =>
        kpi.sub === null ? [] : [[{ text: `${kpi.label}: ${kpi.value}, ${kpi.sub}` }]],
      ),
    context: studied
      ? fill(words.context, { label: studied.label, value: studied.value, sub: studied.sub ?? '' })
      : source,
  };
}

/**
 * The Problem Analysis model from the engine's reply: the page of the `a10-problems` figure, whole. Its eight figures,
 * two charts and six tables are kept as the engine printed them; dates read DD-MMM-YYYY, a machine or a person in a
 * cell is a chip, and a drop-down the platform flattened into text keeps only its chosen word. Null when the engine
 * has no page for it.
 */
export function problemAnalysisModel(
  reply: FiguresPart,
  t: TFunction,
): ProblemAnalysisModel | null {
  const page = pageOf(figureOf(reply, KEY), t);
  if (page === null) return null;
  const words = problemAnalysisWords(t);
  const source = fill(words.source, { date: shortDate(reply.asOf) });
  const find = (first: string, ok?: (t: PageTable) => boolean) => named(page.tables, first, ok);
  const families = find('Family', (table) => table.header.length === 6);
  const table = (found: PageTable | undefined, chips?: PrintedChip[], keep?: number[]) =>
    found ? printedTable(found, chips, keep) : null;
  const unplaced = find('Date', (x) => x.header[4] === 'Group');
  const unrecognised = find('Word');
  const editor = find('Order');
  const say: Translate = (key, values) => t(key, { ...values }) as string;
  const figures = page.kpis.map((kpi, at) => ({
    id: `kpi-${at}`,
    ...kpi,
    sub: kpi.sub ?? '',
    ...(at === 0 ? { drill: drillFor(reply, KEY, say) } : {}),
  }));
  return {
    verdict: verdictOf(page, words, source),
    studied: figures.slice(0, PAGE_FIGURES),
    whatIf: figures.slice(PAGE_FIGURES),
    charts: page.charts.map((spec) => chartOf(spec, words)),
    groups: table(find('Problem group'), familyChips(families, words.all)),
    families: table(families),
    repeats: table(find('Machine', (x) => x.header[3] === 'Times')),
    unplaced: table(unplaced && named_(tidy(unplaced, 4), 5, words.accept), undefined, [5]),
    unrecognised: table(unrecognised && tidy(unrecognised, 4)),
    editor: editor
      ? {
          ...printedTable(named_(editor, 4, words.remove), undefined, [0, 3, 4]),
          title: editor.title || words.editorTitle,
        }
      : null,
    source,
    words,
  };
}
