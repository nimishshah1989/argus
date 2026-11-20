import type { DecisionDetailWords } from '../../../ui/v2/domain/decision-detail.js';
import type { DecisionListWords } from '../../../ui/v2/domain/decision-list.js';
import type { DecisionData } from '../../../ui/v2/domain/decision-row.js';
import type { MachineData } from '../../../ui/v2/domain/plant.js';
import type { TableWords } from '../../../ui/v2/data-table.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { Point } from '../../../ui/v2/points.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';

/** A decision that is not waiting: parked until a day, or settled. Its chip opens it in the drawer like any other. */
export type SettledDecision = {
  decision: DecisionData;
  status: 'parked' | 'settled';
  /** One sentence: the decision (a chip), when it comes back or was settled, and who. */
  line: Point;
};

/** A machine that keeps coming up: its open nudges by priority, the engine's score, and the next step. */
export type WatchRow = {
  machine: MachineData;
  high: number;
  medium: number;
  low: number;
  /** The engine's score (high 3, medium 2, low 1 each): as printed, and the number that sorts it. */
  score: { shown: string; value: number };
  next: string;
};

/**
 * Everything the Action Center prints, and the contract the API fills: the decisions to take today, who owns them,
 * what is parked or settled, and the machines that keep coming up. Words and figures arrive ready to print.
 */
export type ActionCenterModel = {
  verdict: VerdictData;
  /** Two to four key figures. */
  kpis: KpiData[];
  /** The decisions waiting, biggest first. */
  decisions: DecisionData[];
  /** One sentence per owner, biggest first, the decisions nobody owns last. */
  owners: Point[];
  /** The decisions that are not waiting, newest first. */
  settled: SettledDecision[];
  /** Machines with the most open nudges, worst score first. */
  watch: WatchRow[];
  /** Where the figures came from and how fresh they are (DD-MMM-YYYY, IST). */
  source: string;
  words: ActionCenterWords;
};

export type ActionCenterWords = {
  why: string;
  whyThese: string;
  decisions: DecisionListWords;
  decisionDetail: DecisionDetailWords;
  ownersTitle: string;
  /** The one action under the owners, e.g. "Assign the 2 unowned decisions". */
  assign: string;
  settledTitle: string;
  settledLabel: string;
  /** `{n}` decisions in the tab. */
  tabs: { parked: string; settled: string };
  settledEmpty: string;
  watch: TableWords & {
    columns: { machine: string; score: string; nudges: string; next: string };
    /** `{n}` nudges of that priority. */
    priority: { high: string; medium: string; low: string };
    filters: { all: string; high: string; medium: string };
  };
};

/** What the reader asks for; nothing goes to the network in the gallery. A decision's state comes back in the model. */
export type ActionCenterActions = {
  onDecide?: (decisionId: string) => void;
  onUndo?: (decisionId: string) => void;
  onAssign?: () => void;
};
