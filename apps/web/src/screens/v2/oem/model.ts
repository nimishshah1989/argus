import type { TableModel } from '../../../ui/v2/domain/engine-table.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';

/** OEM analytics: how the machines under 300 days old have broken down, and whose side each cause is on. */
export type OemModel = {
  verdict: VerdictData;
  kpis: KpiData[];
  /** The young machines, by make and model, the faults that repeat across a model, and every breakdown on a young machine. */
  tables: TableModel[];
  source: string;
  words: { why: string };
};
