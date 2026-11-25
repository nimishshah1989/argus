import type { TFunction } from 'i18next';
import { fill } from '../../../i18n/fill.js';
import type { Takeaways } from '../../../ui/v2/takeaway.js';
import type { PageTable } from '../../analytics/page-content.js';
import type { Translate } from '../figures/read.js';
import { outlierTakeaway, takeawayFor, tagOf, type Item } from '../insight.js';
import { chartOf, figuresOf, tablesOf } from '../printed-page/page-model.js';
import { figureOf, pageOf, shortDate } from '../printed-page/printed.js';
import type { FiguresPart, Page } from '../printed-page/printed.js';
import { verdictOf } from '../printed-page/verdict.js';
import { pageWords } from '../printed-page/words.js';
import { drillFor } from '../rows-behind/drill.js';
import type { MoneyMattersModel } from './model.js';
import { groupsOf, rupees } from './tiles.js';

/** The engine's figure this screen is built from (page `mm`); the server leaves it out for a login without money rights. */
export const FIGURE = 'money-matters';
const LEVERS = 'Where the money could have been more';
const LOST = 'Where the money was lost';

const column = (table: PageTable, label: string): number =>
  table.header.findIndex((h) => h.startsWith(label));
const cell = (row: string[] | undefined, at: number): string => row?.[at] ?? '';
const glue = /([a-z])([A-Z])/;
/** `Fix repeat problems for goodThe same problem...` as `Fix repeat problems for good: The same problem...`: the platform printed a name and its note in one cell. */
const spaced = (text: string): string => text.replace(glue, '$1: $2');

/** The lever table, with its last (combined) row left as printed. */
function leversTable(table: PageTable): PageTable {
  return {
    ...table,
    rows: table.rows.map((row, at) =>
      at === table.rows.length - 1 ? row : row.map((text, i) => (i === 0 ? spaced(text) : text)),
    ),
  };
}

function leversTakeaway(table: PageTable | undefined, t: TFunction) {
  const [hours, money] = table
    ? [column(table, 'Hours'), column(table, 'Money per year')]
    : [-1, -1];
  const rows = table?.rows ?? [];
  const combined = rows.at(-1);
  const levers = rows.slice(0, -1);
  if (hours < 0 || money < 0 || !combined || levers.length === 0) return null;
  const top = levers.reduce((a, b) => (rupees(cell(b, money)) > rupees(cell(a, money)) ? b : a));
  const total = rupees(cell(combined, money));
  const overlap =
    levers.reduce((sum, row) => sum + Number(cell(row, hours).replaceAll(',', '')), 0) -
    Number(cell(combined, hours).replaceAll(',', ''));
  if (!(total > 0) || !Number.isFinite(overlap)) return null;
  return {
    text: t('v2mm.levers', {
      name: spaced(cell(top, 0)).split(': ')[0],
      money: cell(top, money),
      pct: Math.round((rupees(cell(top, money)) / total) * 100),
      total: cell(combined, money),
      overlap: overlap.toLocaleString('en-US'),
    }),
    tone: 'risk' as const,
    tag: tagOf('risk', t),
  };
}

function takeawaysOf(page: Page, t: TFunction): Takeaways {
  const lost = page.tables.find((table) => table.title === LOST);
  const problem = lost ? column(lost, 'Problem') : -1;
  const money = lost ? column(lost, 'Money (period)') : -1;
  const items: Item[] =
    lost && problem >= 0 && money >= 0
      ? lost.rows.map((row) => ({
          name: cell(row, problem),
          value: rupees(cell(row, money)),
          shown: cell(row, money),
        }))
      : [];
  const spec = page.charts[0];
  const bars =
    spec?.kind === 'bar'
      ? spec.categories.map((name, i) => ({
          name,
          value: spec.series[0]?.values[i] ?? 0,
          shown:
            items.find((item) => item.name === name)?.shown ?? String(spec.series[0]?.values[i]),
        }))
      : [];
  return {
    levers: leversTakeaway(
      page.tables.find((table) => table.title === LEVERS),
      t,
    ),
    chart: bars.length ? outlierTakeaway(bars, t) : null,
    lost: items.length ? takeawayFor(items, { worse: 'high', additive: true }, t) : null,
  };
}

/** What breakdowns cost and what could have been added, then the largest loss, all as the engine printed them. */
function verdictFor(page: Page, source: string, t: TFunction) {
  const kpi = (label: string) => page.kpis.find((k) => k.label === label);
  const lost = kpi('Money lost to breakdowns');
  const table = page.tables.find((candidate) => candidate.title === LOST);
  const first = table?.rows[0];
  const why =
    table && first
      ? [
          [
            {
              text: t('v2mm.biggest', {
                name: cell(first, column(table, 'Problem')),
                money: cell(first, column(table, 'Money (period)')),
                share: cell(first, column(table, 'Share')),
              }),
            },
          ],
        ]
      : [];
  const headline = t('v2mm.verdict', {
    lost: lost?.value ?? '',
    period: lost?.sub ?? '',
    gain: kpi('Could have been added')?.value ?? '',
  });
  return verdictOf([{ text: headline }], why, source);
}

/**
 * S22 from the engine reply. `money` false (v1 `mayReadMoney`) is the refusal, whatever the reply holds; otherwise null
 * when the figure is missing or not ready, never an invented figure.
 */
export function moneyMattersModel(
  reply: FiguresPart,
  t: TFunction,
  viewer: { money: boolean },
): MoneyMattersModel | null {
  if (!viewer.money)
    return {
      refused: true,
      title: t('analytics.money.refusedTitle'),
      body: t('analytics.money.refusedBody'),
    };
  const page = pageOf(figureOf(reply, FIGURE), t);
  if (page === null) return null;
  const words = pageWords(t, 'v2mm.source');
  const say_: Translate = (key, values) => t(key, { ...values }) as string;
  const source = fill(words.source, { date: shortDate(reply.asOf) });
  return {
    refused: false,
    verdict: verdictFor(page, source, t),
    groups: groupsOf(figuresOf(page.kpis), t),
    chart: page.charts[0] ? chartOf(page.charts[0], words) : null,
    tables: tablesOf(
      page.tables.map((table) => (table.title === LEVERS ? leversTable(table) : table)),
      words,
    ),
    takeaways: takeawaysOf(page, t),
    drill: drillFor(reply, FIGURE, say_),
    source,
    words,
  };
}
