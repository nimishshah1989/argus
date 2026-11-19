import { MAX_DRILL_IDS } from '@uptimo/shared/analytics';
import type { MessageKey } from '@uptimo/shared/i18n';
import { groupOfScreen } from './groups.js';
import { bag, list, num, pickNum, text, texts } from './read-value.js';

/**
 * The machine page's reliability block (ticket 67, packet 67c): the total reader for the stored `reliability`
 * figure, `{machines: {[id]: MachineReliability}}` exactly as packet 67b keeps it. A fitted block carries the
 * Weibull shape, scale and mean, its sample, its Kaplan-Meier quartiles and its Crow-AMSAA word; a machine under
 * the minimum is `insufficient`, and a plant with no shift window is `no_basis`. Nothing is invented: a number the
 * value lacks returns nothing, and an unknown trend word is not a trend claim.
 */

export type TrendWord = 'improving' | 'worsening' | 'no_clear_trend';

/** The catalogue word for each stored label; the slope is printed beside it. */
export const TREND_WORDS: Readonly<Record<TrendWord, MessageKey>> = {
  improving: 'analytics.machine.fit.improving',
  worsening: 'analytics.machine.fit.worsening',
  no_clear_trend: 'analytics.machine.fit.noTrend',
};

const TREND_LABELS = Object.keys(TREND_WORDS) as TrendWord[];

export interface QuartileView {
  q25: number;
  median: number;
  q75: number;
}

export type FitView =
  | {
      status: 'fitted';
      basis: 'machine' | 'category';
      category: string | null;
      ownEvents: number;
      shape: number;
      scale: number;
      meanHours: number;
      events: number;
      completeIntervals: number;
      censoredHours: number;
      quartiles: QuartileView;
      trend: { beta: number; n: number; word: TrendWord };
    }
  | {
      status: 'insufficient';
      ownEvents: number;
      category: string | null;
      categoryEvents: number;
      minimum: number;
    }
  | { status: 'no_basis' };

export interface SpareView {
  name: string;
  uses: number;
  downtimeHours: number;
  lastOn: string | null;
}

export interface ReliabilityView {
  fit: FitView;
  spares: { rows: SpareView[]; total: number | null };
  drill: { fit: string[]; spares: string[] };
}

/** A fitted block's numbers, all of them required: a block missing one is not a fit the page can print. */
function fittedOf(fit: Record<string, unknown>): FitView | null {
  const basis = text(fit.basis);
  const category = text(fit.category);
  if ((basis !== 'machine' && basis !== 'category') || (basis === 'category' && category === null))
    return null;
  const quartiles = bag(fit.quartiles);
  const trend = bag(fit.trend);
  if (!quartiles || !trend) return null;
  const numbers = {
    ownEvents: num(fit.ownEvents),
    shape: num(fit.shape),
    scale: num(fit.scale),
    meanHours: num(fit.meanHours),
    events: num(fit.events),
    completeIntervals: num(fit.completeIntervals),
    censoredHours: num(fit.censoredHours),
    q25: num(quartiles.q25),
    median: num(quartiles.median),
    q75: num(quartiles.q75),
    beta: num(trend.beta),
    n: num(trend.n),
  };
  if (Object.values(numbers).some((value) => value === null)) return null;
  const label = text(trend.label);
  const word = TREND_LABELS.find((candidate) => candidate === label) ?? 'no_clear_trend';
  return {
    status: 'fitted',
    basis,
    category,
    ownEvents: numbers.ownEvents as number,
    shape: numbers.shape as number,
    scale: numbers.scale as number,
    meanHours: numbers.meanHours as number,
    events: numbers.events as number,
    completeIntervals: numbers.completeIntervals as number,
    censoredHours: numbers.censoredHours as number,
    quartiles: {
      q25: numbers.q25 as number,
      median: numbers.median as number,
      q75: numbers.q75 as number,
    },
    trend: { beta: numbers.beta as number, n: numbers.n as number, word },
  };
}

/** One stored `FitBlock` as the block prints it; null when it cannot be printed without inventing a number. */
function parseFit(raw: unknown): FitView | null {
  const fit = bag(raw);
  if (!fit) return null;
  const status = text(fit.status);
  if (status === 'no_basis') return { status: 'no_basis' };
  if (status === 'fitted') return fittedOf(fit);
  if (status !== 'insufficient') return null;
  const ownEvents = pickNum(fit, 'ownEvents');
  const categoryEvents = pickNum(fit, 'categoryEvents');
  const minimum = pickNum(fit, 'minimum');
  if (ownEvents === null || categoryEvents === null || minimum === null) return null;
  return {
    status: 'insufficient',
    ownEvents,
    category: text(fit.category),
    categoryEvents,
    minimum,
  };
}

/** One spare row: a part with no name or no count is dropped, never printed as a made-up part. */
function spareOf(raw: unknown): SpareView[] {
  const row = bag(raw);
  if (!row) return [];
  const name = text(row.name);
  const uses = pickNum(row, 'uses');
  const downtimeHours = pickNum(row, 'downtimeHours');
  if (name === null || uses === null || downtimeHours === null) return [];
  return [{ name, uses, downtimeHours, lastOn: text(row.lastOn) }];
}

/** The block a machine page reads; null for a machine the figure does not hold, or a block it cannot print. */
export function reliabilityOf(value: unknown, machineId: string): ReliabilityView | null {
  const machines = bag(bag(value)?.machines);
  const entry = bag(machines?.[machineId]);
  if (!entry) return null;
  const fit = parseFit(entry.fit);
  if (!fit) return null;
  const spares = bag(entry.spares);
  const drill = bag(entry.drill);
  return {
    fit,
    spares: { rows: list(spares?.rows).flatMap(spareOf), total: num(spares?.total) },
    drill: { fit: texts(drill?.fit), spares: texts(drill?.spares) },
  };
}

/** The house drill cap: the machine's own rows, and the Breakdown log once it names more than one ask may take. */
export type DrillLink =
  { kind: 'drill'; href: string } | { kind: 'log'; href: string; count: number };

export function drillLinkOf(
  machineId: string,
  type: string,
  ids: readonly string[],
): DrillLink | null {
  if (ids.length === 0) return null;
  if (ids.length <= MAX_DRILL_IDS)
    return {
      kind: 'drill',
      href: `/analytics/machines/${machineId}?drill=${encodeURIComponent(`${type}:${ids.join(',')}`)}`,
    };
  const group = groupOfScreen('breakdown-log');
  return {
    kind: 'log',
    href: `/analytics/${group?.id ?? 'breakdowns'}?screen=breakdown-log`,
    count: ids.length,
  };
}
