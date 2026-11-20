import type { BulletData } from '../../../ui/v2/bullet-bar.js';
import type { DecisionData } from '../../../ui/v2/domain/decision-row.js';
import type { ParetoData } from '../../../ui/v2/pareto.js';
import type { CellData, PlantWords } from '../../../ui/v2/domain/plant.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';

/**
 * Everything the Dashboard prints, and the contract the API fills. Every figure and every word arrives here
 * ready to print (the engine's numbers, the reader's language); the screen only arranges them. Numbers
 * beside a printed figure (`hours`, `value`) only place a mark on a chart.
 */
export type DashboardModel = {
  verdict: VerdictData;
  /** Biggest first. */
  decisions: DecisionData[];
  cells: CellData[];
  bullets: BulletData[];
  pareto: ParetoData;
  words: DashboardWords;
};

export type DashboardWords = {
  why: string;
  whyThese: string;
  decideTitle: string;
  /** `{n}` waiting, before any is decided. */
  decideWaiting: string;
  /** `{n}` of `{total}` decided. */
  decideDone: string;
  perMonth: string;
  stripCaption: string;
  plant: PlantWords;
  targetTitle: string;
  legend: { actual: string; target: string; last: string; zone: string };
  paretoTitle: string;
  addFocus: string;
  seeFixes: string;
};

/** What the reader asks for; nothing goes to the network in the gallery. A decision's state comes back in the model. */
export type DashboardActions = {
  onDecide?: (decisionId: string) => void;
  onUndo?: (decisionId: string) => void;
  onAddFocus?: () => void;
  onSeeFixes?: () => void;
};
