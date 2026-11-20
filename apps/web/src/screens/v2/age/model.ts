import type { TableModel } from '../../../ui/v2/domain/engine-table.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';

/** The age analysis: which age band loses the most hours per machine, band by band. */
export type AgeModel = {
  verdict: VerdictData;
  /** One card per age band: the average breakdown hours per machine. */
  kpis: KpiData[];
  /** Every band: its hours, its machines and breakdowns, its average and how it was worked out. */
  bands: TableModel;
  source: string;
  words: { why: string };
};
