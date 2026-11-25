import type { TFunction } from 'i18next';
import { readable } from '../../../ui/v2/format.js';
import type { Point } from '../../../ui/v2/points.js';
import type { PrintedTable } from '../../../ui/v2/domain/printed-table.js';
import type { Meaning, Takeaways } from '../../../ui/v2/takeaway.js';
import { fill } from '../../../i18n/fill.js';
import { numberIn, type Translate } from '../figures/read.js';
import { takeawayFor, type Item } from '../insight.js';
import { byTitle, figuresOf, rowWithMost, tablesOf, chartOf } from '../printed-page/page-model.js';
import {
  cellChip,
  figureOf,
  pageOf,
  type Page,
  shortDate,
  type FiguresPart,
} from '../printed-page/printed.js';
import { chartNotes, tableNotes } from '../printed-page/notes.js';
import { say, strong } from '../printed-page/segs.js';
import { kpiOf, verdictOf } from '../printed-page/verdict.js';
import { pageWords } from '../printed-page/words.js';
import { seeRowsFor } from '../rows-behind/drill.js';
import type { BdPmModel } from './model.js';

export const FIGURE = 'a1-bd-pm';
const CELLS = 'By Cell — Detail';
/** The By Cell table's columns: name, machines, available hours, BD hours, BD %, PM hours, PM %, total %. */
const COL = { cell: 0, bd: 4, pm: 6, total: 7 } as const;
/** What each section's measure means (ADR 0026 §4): a higher share or hour count is the worse side; hours add up. */
const MEANING: Record<string, Meaning> = {
  cell: { worse: 'high' },
  'bd-share': { worse: 'high' },
  'pm-share': { worse: 'high' },
  'bd-hours': { worse: 'high', additive: true },
  'pm-hours': { worse: 'high', additive: true },
};

/** The section a printed table is, by the engine's title; a paired month-on-month table ends in its measure ("· BD %"). */
export function sectionOf(title: string): string | undefined {
  if (title === CELLS) return 'cell';
  if (title.endsWith(' · BD %')) return 'bd-share';
  if (title.endsWith(' · PM %')) return 'pm-share';
  if (title.includes('BD Hours by Cell')) return 'bd-hours';
  if (title.includes('PM Hours by Cell')) return 'pm-hours';
  return undefined;
}

/** A section's table as items: one per cell row, the PLANT TOTAL row left out, valued by its last column as printed. */
function itemsOf(table: PrintedTable): Item[] {
  return table.rows.flatMap((row) => {
    const name = row[0]?.text ?? '';
    const shown = row[row.length - 1]?.text ?? '';
    const value = numberIn(shown);
    return name === '' || /^plant total/i.test(name) || value === null
      ? []
      : [{ name, value, shown }];
  });
}

/** One kit line per section, computed from its own table; null when the engine printed no such table. */
function takeawaysOf(tables: PrintedTable[], t: TFunction): Takeaways {
  const say_ = (key: string) => t(key) as string;
  return Object.fromEntries(
    Object.entries(MEANING).map(([id, meaning]) => {
      const table = tables.find((candidate) => sectionOf(candidate.title) === id);
      return [id, table ? takeawayFor(itemsOf(table), meaning, say_) : null];
    }),
  );
}

/** The figure's value as the page prints it, or undefined when the engine did not print that figure. */
function valueOf(page: Page, label: string): number | undefined {
  const found = kpiOf(page, label);
  return found === undefined ? undefined : (numberIn(found.value) ?? undefined);
}

/** `part` as a share of `whole` in whole percent, with the whole printed beside it: the kit's share line. */
const shareLine = (t: TFunction, part: number, whole: number, shown: string): string =>
  fill(t('insight.yardstick.share'), { pct: Math.round((part / whole) * 100), total: shown });

/** A whole-hours total: lakh-scale reads "7.50 lakh" (R11), anything under a lakh keeps its Indian grouping. */
const wholeText = (n: number): string => (n >= 1e5 ? readable(n) : n.toLocaleString('en-IN'));

/** BD and PM hours as a share of their sum, the sum printed to one place. */
function hoursYardsticks(page: Page, t: TFunction): Record<string, string> {
  const [bd, pm] = [valueOf(page, 'Actual Breakdown'), valueOf(page, 'PM Downtime')];
  if (bd === undefined || pm === undefined) return {};
  const sum = bd + pm;
  const total =
    sum >= 1e5
      ? readable(sum)
      : sum.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return {
    'Actual Breakdown': shareLine(t, bd, sum, total),
    'PM Downtime': shareLine(t, pm, sum, total),
  };
}

/** Available hours against the annual hours the page prints ("annual 6,000"), and the plant against all its machines. */
function availableYardsticks(page: Page, t: TFunction): Record<string, string> {
  const annual = /annual ([\d,]+)/.exec(kpiOf(page, 'Avg Available Hrs / Machine')?.sub ?? '');
  const hours = annual ? numberIn(annual[1] ?? '') : null;
  const [perMachine, plant, machines] = [
    valueOf(page, 'Avg Available Hrs / Machine'),
    valueOf(page, 'Total Available Hrs'),
    valueOf(page, 'Total Machines'),
  ];
  // shortcut: no peer or prior for the machine count in this reply, upgrade when the engine sends a prior period.
  const found: Record<string, string> = { 'Total Machines': t('v2m.none') };
  if (hours !== null && perMachine !== undefined)
    found['Avg Available Hrs / Machine'] = shareLine(t, perMachine, hours, annual?.[1] ?? '');
  if (hours !== null && machines !== undefined && plant !== undefined) {
    const whole = hours * machines;
    found['Total Available Hrs'] = shareLine(t, plant, whole, wholeText(whole));
  }
  return found;
}

/** Fleet availability against its average: 100% minus the mean of the cells' Total %, two places; '' with no cells. */
function fleetYardstick(cells: Item[], t: TFunction): string {
  if (cells.length === 0) return '';
  const mean = cells.reduce((sum, cell) => sum + cell.value, 0) / cells.length;
  return fill(t('insight.yardstick.average'), { value: `${(100 - mean).toFixed(2)}%` });
}

function headlineOf(page: Page, t: TFunction): Point {
  const [bd, pm, availability] = [
    kpiOf(page, 'Actual Breakdown'),
    kpiOf(page, 'PM Downtime'),
    kpiOf(page, 'Fleet Availability'),
  ];
  if (!bd || !pm || !availability) return [{ text: t('v2r.noFigures') }];
  return say(t('v2r.bd.headline'), {
    bd: strong(bd.value),
    bdSub: bd.sub ?? '',
    pm: strong(pm.value),
    pmSub: pm.sub ?? '',
    availability: strong(availability.value),
  });
}

/** The cell the By Cell table says loses the most of its available hours, as a sentence with the cell a chip. */
function worstCell(page: Page, t: TFunction): Point | null {
  const row = rowWithMost(byTitle(page, CELLS), COL.total);
  if (!row) return null;
  const name = row[COL.cell] ?? '';
  return say(t('v2r.bd.worst'), {
    cell: { text: name, entity: cellChip(name) },
    total: strong(row[COL.total] ?? ''),
    bd: row[COL.bd] ?? '',
    pm: row[COL.pm] ?? '',
  });
}

/**
 * The BD % and PM split model from the engine's reply: the page of the `a1-bd-pm` figure, whole. Its six figures, two
 * charts and four tables are kept as printed (the two paired month-on-month rows become one table per measure), and the
 * answer is read from the printed figures and the cell the table says loses the most. Null when the engine has no page.
 */
export function bdPmModel(reply: FiguresPart, t: TFunction): BdPmModel | null {
  const page = pageOf(figureOf(reply, FIGURE), t);
  if (page === null) return null;
  const words = pageWords(t, 'v2r.bd.source');
  const source = fill(words.source, { date: shortDate(reply.asOf) });
  const say_: Translate = (key, values) => t(key, { ...values }) as string;
  const availability = kpiOf(page, 'Fleet Availability')?.sub;
  const tables = tablesOf(page.tables, words);
  const cells = tables.find((table) => sectionOf(table.title) === 'cell');
  const yardsticks: Record<string, string> = {
    ...hoursYardsticks(page, t),
    ...availableYardsticks(page, t),
    'Fleet Availability': fleetYardstick(cells ? itemsOf(cells) : [], t),
  };
  return {
    verdict: verdictOf(
      headlineOf(page, t),
      [
        availability ? say(t('v2r.bd.availability'), { sub: availability }) : null,
        worstCell(page, t),
      ],
      source,
    ),
    figures: figuresOf(page.kpis).map((figure) =>
      yardsticks[figure.label] ? { ...figure, yardstick: yardsticks[figure.label] } : figure,
    ),
    charts: chartNotes(
      page.charts.map((spec) => chartOf(spec, words)),
      { [t('analytics.content.a1.trendChart')]: t('v2r.note.bd.trend') },
    ),
    tables: tableNotes(tables, [
      [CELLS, t('v2r.note.bd.cell')],
      ['Month-on-Month — BD %', t('v2r.note.bd.share')],
      ['Month-on-Month — BD Hours by Cell', t('v2r.note.bd.hours')],
    ]),
    takeaways: takeawaysOf(tables, t),
    drill: seeRowsFor(reply, FIGURE, say_),
    source,
    words,
  };
}
