import type { TFunction } from 'i18next';
import { fill } from '../../../i18n/fill.js';
import type { Point } from '../../../ui/v2/points.js';
import type { Takeaways } from '../../../ui/v2/takeaway.js';
import type { PageTable } from '../../analytics/page-content.js';
import type { Translate } from '../figures/read.js';
import { takeawayFor, type Item } from '../insight.js';
import { chartOf, figuresOf, tablesOf } from '../printed-page/page-model.js';
import type { ForecastLabModel } from './model.js';
import { figureOf, numberValue, pageOf, shortDate } from '../printed-page/printed.js';
import type { FiguresPart, Page } from '../printed-page/printed.js';
import { say, strong } from '../printed-page/segs.js';
import { verdictOf } from '../printed-page/verdict.js';
import { pageWords } from '../printed-page/words.js';
import { drillFor } from '../rows-behind/drill.js';

/** The engine's figure this screen is built from. */
export const FIGURE = 'forecast-lab';
const METHODS = 'How each method did';
const DETAIL = 'Month detail';
/** The words the engine glues to the front of the method cell and of the verdict cell; the rest is the explanation. */
const METHOD_NAME = /^(Current model in use|Age-adjusted|Recent-weighted|Age \+ recent)/;
const VERDICT_WORD = /^(Baseline|Do not adopt|Adopt)/;

const column = (table: PageTable | undefined, label: string): number =>
  table?.header.findIndex((h) => h.startsWith(label)) ?? -1;

/** `Age-adjustedSame, but...` as `Age-adjusted: Same, but...`: the platform printed a name and its note in one cell. */
const spaced = (cell: string, lead: RegExp): string => {
  const found = lead.exec(cell);
  return found && cell.length > found[0].length
    ? `${found[0]}: ${cell.slice(found[0].length)}`
    : cell;
};

function tidied(table: PageTable): PageTable {
  if (table.title !== METHODS) return table;
  const [method, verdict] = [column(table, 'Method'), column(table, 'Verdict')];
  return {
    ...table,
    rows: table.rows.map((row) =>
      row.map((cell, at) =>
        at === method
          ? spaced(cell, METHOD_NAME)
          : at === verdict
            ? spaced(cell, VERDICT_WORD)
            : cell,
      ),
    ),
  };
}

type Rows = { table: PageTable; method: number; verdict: number; score: number };

function methodsOf(page: Page): Rows | null {
  const table = page.tables.find((candidate) => candidate.title === METHODS);
  if (!table) return null;
  const found = {
    table,
    method: column(table, 'Method'),
    verdict: column(table, 'Verdict'),
    score: column(table, 'Accuracy score'),
  };
  return found.method < 0 || found.verdict < 0 || found.score < 0 ? null : found;
}

const nameOf = (cell: string): string => METHOD_NAME.exec(cell)?.[0] ?? cell;

/** The section id of a printed table (ADR 0035): `methods` or `months`; '' for any other table, which opens with no takeaway. */
export const sectionOf = (title: string): string =>
  title === METHODS ? 'methods' : title.startsWith(DETAIL) ? 'months' : '';

const itemsOf = (table: PageTable, name: number, value: number): Item[] =>
  table.rows.map((row) => ({
    name: nameOf(row[name] ?? ''),
    value: numberValue(row[value] ?? ''),
    shown: row[value] ?? '',
  }));

/** One takeaway per table, from the table the engine printed: the methods by accuracy score, the months by actual hours. */
function takeawaysOf(page: Page, tables: PageTable[], t: TFunction): Takeaways {
  const methods = methodsOf(page);
  const detail = tables.find((table) => sectionOf(table.title) === 'months');
  const hours = column(detail, 'Actual hrs');
  return {
    methods: methods
      ? takeawayFor(itemsOf(methods.table, methods.method, methods.score), { worse: 'high' }, t)
      : null,
    months:
      detail && hours >= 0
        ? takeawayFor(
            itemsOf(detail, column(detail, 'Month'), hours),
            { worse: 'high', additive: true },
            t,
          )
        : null,
  };
}

/** The model in use is the engine's baseline row; the rest are the methods that were tried against it. */
function baselineOf(rows: Rows) {
  return rows.table.rows.find((row) => /^Baseline/.test(row[rows.verdict] ?? ''));
}

function headlineOf(page: Page, t: TFunction): Point {
  const rows = methodsOf(page);
  const base = rows && baselineOf(rows);
  const months = page.tables.find((candidate) => candidate.title.startsWith(DETAIL))?.rows.length;
  if (!rows || !base || months === undefined) return [{ text: t('v2r.noFigures') }];
  const adopted = rows.table.rows.filter((row) => /^Adopt/.test(row[rows.verdict] ?? '')).length;
  return say(t('v2l.headline'), {
    score: strong(base[rows.score] ?? ''),
    months: String(months),
    decision: adopted === 0 ? t('v2l.noneBetter') : fill(t('v2l.adopt'), { n: adopted }),
  });
}

/** The method that scored best, when it is not the model in use, with the engine's own verdict on it. */
function bestLine(page: Page, t: TFunction): Point | null {
  const rows = methodsOf(page);
  const base = rows && baselineOf(rows);
  if (!rows || !base) return null;
  const best = rows.table.rows.reduce((top, row) =>
    numberValue(row[rows.score] ?? '') < numberValue(top[rows.score] ?? '') ? row : top,
  );
  return best === base
    ? null
    : say(t('v2l.best'), {
        method: nameOf(best[rows.method] ?? ''),
        score: best[rows.score] ?? '',
        verdict: best[rows.verdict] ?? '',
      });
}

/** The track record of the model in use: in how many of the tested months the plant stayed inside its 80% range. */
function trackLine(page: Page, t: TFunction): Point | null {
  const rows = methodsOf(page);
  const base = rows && baselineOf(rows);
  const inside = column(rows?.table, 'Plant inside 80% range');
  return base && inside >= 0 ? say(t('v2l.track'), { inside: strong(base[inside] ?? '') }) : null;
}

/**
 * The Forecast Lab from the engine's `forecast-lab` figure, whole: the backtest's method table (accuracy, how often the
 * plant stayed inside each range, whether to adopt), the month-by-month detail with every method's range, and the line
 * chart of forecast against actual. A method's name and its note, which the platform printed as one run of text, are
 * said apart. Null when the engine has no page.
 */
export function forecastLabModel(reply: FiguresPart, t: TFunction): ForecastLabModel | null {
  const page = pageOf(figureOf(reply, FIGURE), t);
  if (page === null) return null;
  const words = pageWords(t, 'v2l.source');
  const say_: Translate = (key, values) => t(key, { ...values }) as string;
  const source = fill(words.source, { date: shortDate(reply.asOf) });
  const tables = page.tables.map(tidied);
  return {
    verdict: verdictOf(headlineOf(page, t), [bestLine(page, t), trackLine(page, t)], source),
    figures: figuresOf(page.kpis),
    charts: page.charts.map((spec) => chartOf(spec, words)),
    tables: tablesOf(tables, words),
    drill: drillFor(reply, FIGURE, say_),
    source,
    words,
    takeaways: takeawaysOf(page, tables, t),
  };
}
