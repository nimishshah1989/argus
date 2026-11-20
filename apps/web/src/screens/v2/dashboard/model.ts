import type { ChartSpec } from '../../../ui/chart/use-chart.js';
import type { Drill } from '../../../ui/v2/drill.js';
import type { EntityChipProps } from '../../../ui/v2/entity-chip.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { ParetoData } from '../../../ui/v2/pareto.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';
import type { TableModel } from '../figures/table.js';

/** One ticket that needs a person now: where, what, how long, which clock ran out, and the way to open it. */
export type NeedItem = {
  id: string;
  ref: string;
  /** The machine (a chip that opens it) or, when the ticket names none, where it is. */
  where: { text: string; chip?: EntityChipProps };
  problem: string;
  /** What kind of ticket it is and how long it has waited, one line. */
  line: string;
  breach: string | null;
  href: string;
};

export type NeedsNowModel = {
  title: string;
  /** "3 open · 1 clocks breached". */
  counts: string;
  empty: string;
  open: string;
  items: NeedItem[];
};

/** A picture the engine drew: its spec, the line under its title, what it says aloud and the rows behind it. */
export type DashboardChart = {
  id: string;
  spec: ChartSpec;
  sub: string;
  aria: string;
  drill?: Drill;
};

export type DashboardWords = {
  why: string;
  whyThese: string;
  /** The Action Center banner's link. */
  openActionCenter: string;
};

/**
 * Everything the Dashboard prints, from the engine's own figures: its twenty `dashboard.*` figures each in its own
 * period, the change against 30 days earlier, the strip of what needs a person now and the Action Center's counts.
 * Every figure arrives ready to print; the screen only arranges it.
 */
export type DashboardModel = {
  verdict: VerdictData;
  /** The open high and medium nudges and the way to them; null when none is open. */
  banner: { text: string; href: string } | null;
  /** Null when the desk's open tickets could not be read: the strip is then left out, never shown as an all-clear. */
  needs: NeedsNowModel | null;
  /** The number figures and the breakdown-free sentence, in the engine's order. */
  kpis: KpiData[];
  /** The costliest problems: the bars and the engine's own rows. Null when the engine has none. */
  costliest: { title: string; pareto: ParetoData; table: TableModel } | null;
  charts: DashboardChart[];
  source: string;
  words: DashboardWords;
};
