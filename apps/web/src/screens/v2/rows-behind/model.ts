import type { DrillReply } from '@uptimo/shared/analytics';
import { rowsBehindModel, type LoadBasis } from '../../../ui/v2/domain/rows-behind-adapter.js';
import type { RowsBehindModel } from '../../../ui/v2/domain/rows-behind.js';
import { FIGURE_LABELS, unitOf } from '../../analytics/groups.js';
import type { Translate } from '../figures/read.js';
import { rowsWords } from './words.js';

const indian = (n: number, digits: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/**
 * A figure's value as its tile prints it: a count as a count, hours with one decimal and their unit, a text as it
 * came, "53 of 125" for the breakdown-free pair. A page-shaped figure (a register, a footprint, a problem list) has
 * no single number, so what it prints is how many rows it counted.
 */
export function printedValue(key: string, value: unknown, rows: number, t: Translate): string {
  if (typeof value === 'number') {
    const unit = unitOf(key);
    return unit ? `${indian(value, 1)} ${t(unit)}` : indian(value, Number.isInteger(value) ? 0 : 2);
  }
  if (typeof value === 'string') return value;
  const pair = value as { runningClean?: unknown; inService?: unknown } | null;
  if (typeof pair?.runningClean === 'number' && typeof pair.inService === 'number')
    return `${pair.runningClean} of ${pair.inService}`;
  return indian(rows, 0);
}

/** What the figure is called: the label every screen and the Guide print for its key; the key itself when none is. */
export const figureName = (key: string, t: Translate): string => {
  const label = FIGURE_LABELS[key];
  return label ? t(label) : key;
};

/** The rows behind one figure, from the engine's figure and the drill reply for it; null when nothing is counted. */
export function rowsModel(
  input: {
    key: string;
    value: unknown;
    reply: DrillReply;
    asOf: string;
    machineCode: (id: string) => string | undefined;
    /** A part of a figure (one tile of a map) names itself and its value; the figure's own label and value stand otherwise. */
    named?: { label: string; value: string };
    /** The energy figure's machines also print their connected and running load. */
    load?: LoadBasis;
  },
  t: Translate,
): RowsBehindModel | null {
  const { key, value, reply, asOf, machineCode, named, load } = input;
  return rowsBehindModel({
    figure: {
      key,
      label: named?.label ?? figureName(key, t),
      value: named?.value ?? printedValue(key, value, reply.rows.length, t),
    },
    reply,
    asOf,
    machineCode,
    words: rowsWords(t).adapter,
    ...(load ? { load } : {}),
  });
}
