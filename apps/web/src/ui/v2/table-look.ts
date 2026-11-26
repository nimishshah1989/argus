import { isValidElement, Children, cloneElement, Fragment, type ReactNode } from 'react';
import { exact, formatMinutes } from './format.js';

/**
 * How a table column colours itself (ADR 0061, Nimish 26 Nov: "no conditional formatting in any of them"):
 * - a meaning (`loss`, `gain`, `risk`, `plan`, `neutral`): its numbers get an in-cell bar scaled to the column, and
 *   when the table is ranked by it, its top rows are marked in that colour (loss red, gain green);
 * - `category`: its words are pills from the fixed categorical palette (`--color-v2-cat-1..5`), the same word the
 *   same colour on every table;
 * - `plain`: an id, a date or a count with no meaning, left as it is.
 */
export type ColumnTone = 'loss' | 'gain' | 'risk' | 'plan' | 'neutral';
export type ColumnLook = ColumnTone | 'category' | 'plain';

/** How many of the ranked column's top rows wear its colour. */
export const TOP_MARKS = 3;
/** A table with more coloured number columns than this tints its cells instead of drawing a bar in each. */
export const BAR_COLUMNS = 8;

const PLAIN =
  /^(#|sr\.?( no\.?)?|no\.?|order|year|machines|in entries|available hrs|start of \d{4}|end|added.*|fleet at (start|end)|action|owner|due date|cell|location|serial|uses|same kind|effective machines|young machines|machines added|(avg )?age( \(days\))?)$/i;
const PLAN = /\bpm\b|planned/i;
const GAIN = /mtbf|availab|uptime|\boee\b|saved|quick|kept|capacity left|caught/i;
const LOSS =
  /\bbd\b|breakdown|downtime|\bhours?\b|\bhrs\b|mttr|loss|\blost\b|cost|₹|times|% of|total %|stopp|repeat|cause|per 100 machine-days/i;
const RISK = /score|vs peers/i;
const NEUTRAL =
  /team|supported|people|involvement|specialization|share of machines|area|m²|kva|power|above \d+% line/i;
const CATEGORY = /^(category|family|age band|shift|type|machine type)$/i;

const toneIn = (words: string): ColumnTone | undefined =>
  PLAN.test(words)
    ? 'plan'
    : GAIN.test(words)
      ? 'gain'
      : LOSS.test(words)
        ? 'loss'
        : RISK.test(words)
          ? 'risk'
          : NEUTRAL.test(words)
            ? 'neutral'
            : undefined;

/**
 * The look an engine column declares by its own header (the engine prints English headers; they are data, read as
 * `kindOf` reads them). A number column whose header says nothing (a month, a quarter) takes the meaning of the
 * table's title ("BD Hours by Cell"); one neither names is `undefined`, and the table-look guard lists it.
 */
export function lookOfHeader(label: string, numeric: boolean, title = ''): ColumnLook | undefined {
  const name = label.trim();
  if (!numeric) return CATEGORY.test(name) ? 'category' : undefined;
  if (PLAIN.test(name)) return 'plain';
  return toneIn(name) ?? toneIn(title);
}

/** The categorical colour (1 to 5) a word always gets: a stable hash of its lower-case text. */
export function catOf(text: string): number {
  let h = 0;
  for (const ch of text.trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % 5) + 1;
}

/** The indexes of the `n` largest finite values above 0, largest first (equal values keep their order). */
export function topIndexes(values: readonly unknown[], n = TOP_MARKS): Set<number> {
  return new Set(
    values
      .map((v, at) => ({ v: typeof v === 'number' && Number.isFinite(v) ? v : -Infinity, at }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v || a.at - b.at)
      .slice(0, n)
      .map((x) => x.at),
  );
}

/** A coloured tone, not `neutral`: the ones that mark top rows. */
export const marks = (look: ColumnLook | undefined): look is Exclude<ColumnTone, 'neutral'> =>
  look === 'loss' || look === 'gain' || look === 'risk' || look === 'plan';

/** A number column that draws a bar or a tint. */
export const scaled = (look: ColumnLook | undefined): look is ColumnTone =>
  marks(look) || look === 'neutral';

const RAW = /^-?\d+\.\d{3,}$/;

/** The unit a duration column's numbers are in (DOMAIN.md §5): its cells then read as time, "40 min", "2 h 26 min". */
export type DurationUnit = 'hours' | 'minutes';

const BARE = /^-?[\d,]*\.?\d+$/;

/**
 * No raw float reaches a table (Nimish saw "0.6666666666666666" in the Breakdown log): a string or number cell that is
 * a bare number with three or more decimals prints through `exact` (Indian grouping, at most 2 decimals). In a
 * duration column (`unit`) every bare number reads as time through `formatMinutes` ("0.67" hours is "40 min").
 * Fragments are walked; any other element is left alone.
 */
export function tidyCell(node: ReactNode, unit?: DurationUnit): ReactNode {
  const tidy = (child: ReactNode) => tidyCell(child, unit);
  if (unit && (typeof node === 'number' || (typeof node === 'string' && BARE.test(node.trim()))))
    return formatMinutes(Number(String(node).replace(/,/g, '')) * (unit === 'hours' ? 60 : 1));
  if (typeof node === 'number') return Number.isInteger(node) ? node : exact(node);
  if (typeof node === 'string') return RAW.test(node.trim()) ? exact(Number(node)) : node;
  if (Array.isArray(node)) return node.map(tidy);
  if (isValidElement<{ children?: ReactNode }>(node) && node.type === Fragment)
    return cloneElement(node, {}, ...Children.toArray(node.props.children).map(tidy));
  return node;
}
