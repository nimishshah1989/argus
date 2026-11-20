import type { CompareBoxData } from '../../../ui/v2/domain/compare-box.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { Point } from '../../../ui/v2/points.js';
import type { TrendData } from '../../../ui/v2/trend-chart.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';

/** The two machines asked for, by code. */
export type CompareParams = { a: string; b: string };

/**
 * Everything Compare prints, and the contract the API fills: two machines of the same kind, side by side. Every
 * figure and word arrives ready to print. The boxes carry the same figures in the same order, the biggest
 * difference first, so each line meets its twin.
 */
export type CompareModel = {
  verdict: VerdictData;
  /** The two chosen, and every machine that can be chosen. */
  pick: { a: string; b: string; options: { key: string; label: string }[] };
  /** Two to four key figures: how far apart the pair is. */
  kpis: KpiData[];
  boxes: [CompareBoxData, CompareBoxData];
  /** What differs underneath the figures, ending in the one action that closes the gap. */
  differences: { title: string; points: Point[]; action: string; doneText: string; done: boolean };
  trend: TrendData;
  /** Where the figures came from and how fresh they are (DD-MMM-YYYY, IST). */
  source: string;
  words: CompareWords;
};

export type CompareWords = {
  why: string;
  pickA: string;
  pickB: string;
};

/** What the reader asks for; nothing goes to the network in the gallery. */
export type CompareActions = {
  onPick?: (pair: CompareParams) => void;
  onAddFocus?: () => void;
};
