/* eslint-disable @typescript-eslint/no-unused-vars -- ticket 619 skeleton stubs; the builder deletes this line */
import { fill } from '../../i18n/fill.js';
import type { Meaning, TakeawayData, TakeawayTone } from '../../ui/v2/takeaway.js';

export type Item = { name: string; value: number; shown: string };
type Say = (key: string) => string;

/** The tone's word, from the catalogue (`insight.tag.*`), so colour never stands alone. */
export const tagOf = (tone: TakeawayTone, t: Say) => t(`insight.tag.${tone}`);

/**
 * The generic "X is N× the others" takeaway: the item furthest from its peers (the biggest when `worse` is 'high', the
 * smallest when 'low'), set against the average of the rest. N is printed to one place. With fewer than two items, or an
 * average of 0, or the outlier under `min`× the others, nothing stands out and the line says so in a neutral tone.
 */
export function outlierTakeaway(
  items: Item[],
  t: Say,
  { worse = 'high', min = 1.5 }: { worse?: 'high' | 'low'; min?: number } = {},
): TakeawayData {
  const none: TakeawayData = { text: t('insight.none'), tone: 'neutral', tag: tagOf('neutral', t) };
  if (items.length < 2) return none;
  const top = items.reduce((a, b) =>
    (worse === 'high' ? b.value > a.value : b.value < a.value) ? b : a,
  );
  const rest = items.filter((i) => i !== top);
  const avg = rest.reduce((sum, i) => sum + i.value, 0) / rest.length;
  const n = worse === 'high' ? top.value / avg : avg / top.value;
  if (!Number.isFinite(n) || n < min) return none;
  return {
    text: fill(t('insight.outlier'), { name: top.name, n: n.toFixed(1), value: top.shown }),
    tone: 'loss',
    tag: tagOf('loss', t),
    outlier: top.name,
  };
}

/** A target as a takeaway reads it: the value and how the screen prints it. */
export type Target = { value: number; shown: string };

/**
 * The target line (ADR 0026 §4). An item meets the target when it is on the good side or equal. All meet: gain, "All N
 * meet T". None: loss, "None of the N meet T". Exactly one meets of three or more: loss, "Only X meets T". Otherwise: risk,
 * "K of N miss T; worst is W (shown)", W the item furthest on the bad side. No items: null.
 */
export function targetTakeaway(
  items: Item[],
  target: Target,
  t: Say,
  { worse = 'high' }: { worse?: 'high' | 'low' } = {},
): TakeawayData | null {
  throw new Error('not implemented: ticket 619');
}

/**
 * The concentration line: with six or more items (N counts every item; the total sums only positive values), the fewest largest
 * items that make up at least half the total, when they are no more than a third of the items: risk, "K of N make up P%
 * of the total" (P rounded to a whole percent). Otherwise null.
 */
export function concentrationTakeaway(items: Item[], t: Say): TakeawayData | null {
  throw new Error('not implemented: ticket 619');
}

/**
 * The change line against an earlier period: the change in whole percent of `before`. Up when high is worse (or down when
 * low is worse): loss; the other way: gain; rounds to 0: neutral "No change on P". The delta is signed "+10%" / "−12%"
 * (U+2212 minus). `before` 0 or not finite: null.
 */
export function changeTakeaway(
  change: { now: number; before: number; period: string },
  t: Say,
  { worse = 'high' }: { worse?: 'high' | 'low' } = {},
): TakeawayData | null {
  throw new Error('not implemented: ticket 619');
}

/**
 * The one line a section opens with, picked from what its measure means, first that applies: target, change,
 * concentration (additive measures where high is worse), outlier. Never null: `outlierTakeaway` says when nothing stands out.
 */
export function takeawayFor(items: Item[], meaning: Meaning, t: Say): TakeawayData {
  throw new Error('not implemented: ticket 619');
}

/** A figure tile as the coverage test finds it in a model: a KpiData (has `delta`) or a FigureData (has `sub`). */
export type TileLike = {
  id: string;
  label: string;
  value: string;
  delta?: { text: string };
  sub?: string;
  yardstick?: string;
};

/** A tile has a yardstick when its delta says something or it names one (not blank). */
export function hasYardstick(tile: TileLike): boolean {
  throw new Error('not implemented: ticket 619');
}

/**
 * Every figure tile anywhere in a model: an object with string `id`, `label` and `value` and a `delta` or `sub` key. A
 * tile's own fields are not searched further; arrays and nested objects are; each object is visited once.
 */
export function tilesIn(model: unknown): TileLike[] {
  throw new Error('not implemented: ticket 619');
}
