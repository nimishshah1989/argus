import type { BulletData, BulletLegendWords } from '../../../ui/v2/bullet-bar.js';
import type { DecisionDetailWords } from '../../../ui/v2/domain/decision-detail.js';
import type { DecisionListWords } from '../../../ui/v2/domain/decision-list.js';
import type { DecisionData } from '../../../ui/v2/domain/decision-row.js';
import type { MachineDetailWords } from '../../../ui/v2/domain/machine-detail.js';
import type { MachineTableWords } from '../../../ui/v2/domain/machine-table.js';
import type { CellData, PlantWords as KitPlantWords } from '../../../ui/v2/domain/plant.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { ParetoData } from '../../../ui/v2/pareto.js';
import type { TrendData } from '../../../ui/v2/trend-chart.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';

/**
 * Everything the plant fixture prints, and the contract the API fills. Every figure and every word arrives ready to print
 * (the engine's numbers, the reader's language); the screen only arranges them. Numbers beside a printed figure
 * (`hours.value`, `value`, a trend) only place a mark or sort a column.
 */
export type PlantFixtureModel = {
  verdict: VerdictData;
  /** Two to four key figures. */
  kpis: KpiData[];
  /** Biggest first. */
  decisions: DecisionData[];
  /** Every machine, by cell: the plant map, the machines table and the machine drawer all read these. */
  cells: CellData[];
  bullets: BulletData[];
  trend: TrendData;
  pareto: ParetoData;
  /** Where the figures came from and how fresh they are (DD-MMM-YYYY, IST). */
  source: string;
  words: PlantFixtureWords;
};

export type PlantFixtureWords = {
  why: string;
  whyThese: string;
  decisions: DecisionListWords;
  plant: KitPlantWords;
  targetTitle: string;
  legend: BulletLegendWords;
  paretoTitle: string;
  addFocus: string;
  seeFixes: string;
  decisionDetail: DecisionDetailWords;
  machineDetail: MachineDetailWords;
  machines: MachineTableWords;
};

/** What the reader asks for; nothing goes to the network in the gallery. A decision's state comes back in the model. */
export type PlantActions = {
  onDecide?: (decisionId: string) => void;
  onUndo?: (decisionId: string) => void;
  onAddFocus?: () => void;
  onSeeFixes?: () => void;
};
