import type { TableModel } from '../../../ui/v2/domain/engine-table.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { Takeaways } from '../../../ui/v2/takeaway.js';
import type { TrendData } from '../../../ui/v2/trend-chart.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';

/** The footprint: the floor the fleet needs, and where its space goes by category, cell, location and purchase year. */
export type FootprintModel = {
  verdict: VerdictData;
  kpis: KpiData[];
  /** Cumulative machine area by purchase year, when the engine sent a growth table. */
  growth: TrendData | null;
  /** By category, by cell, by location, growth by year and the ten largest, in the platform's order. */
  tables: TableModel[];
  /** Each table's computed line, keyed by the table's id (ADR 0035, ticket 656); the growth line is drawn above the chart. */
  takeaways?: Takeaways;
  source: string;
  words: { why: string };
};
