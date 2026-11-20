import type { ActionCenterBoardReply } from '@uptimo/shared';
import type { FiguresReply } from '@uptimo/shared/analytics';
import type { Ticket } from '../../../api.js';
import type { ChartSpec } from '../../../ui/chart/use-chart.js';
import type { TableModel } from '../../../ui/v2/domain/engine-table.js';
import type { Drill } from '../../../ui/v2/drill.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { Point } from '../../../ui/v2/points.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';

/**
 * Everything the Dashboard prints, built from the engine's reply and the desk's open tickets by `adapter.ts`. Every
 * figure arrives as the engine printed it and every word in the reader's language; the screen only arranges them.
 * There is no money anywhere in it: Today never showed any, so there is nothing to withhold from a role.
 */
export type DashboardModel = {
  verdict: VerdictData;
  /** What needs a person now, from the open tickets: a table, or the honest line that it could not be read. */
  needs: NeedsModel;
  /** The Action Center's open high and medium nudges, with the way in; none when no nudge is open. */
  actionCenter: { title: string; text: string; open: string; href: string } | null;
  /** The engine's figures as cards, in three groups. */
  sections: { id: string; title: string; sub: string; kpis: KpiData[] }[];
  costliest: CostliestModel | null;
  /** Machines the engine's own trend test calls worse than before; none when the figure is not computed. */
  warning: WarningModel | null;
  /** The bubble chart and the expansion timeline, each with the rows it was drawn from. */
  charts: ChartModel[];
  /** Every machine on the bubble chart, worst first. */
  machines: TableModel | null;
  /** Where the figures came from and the day they are for. */
  source: string;
  words: { why: string };
};

/** A picture, or the line that stands where it would be (not computed yet, or nothing recorded). */
export type ChartModel = { id: string; title: string } & (
  { spec: ChartSpec; sub: string; aria: string; drill?: Drill } | { note: string }
);

export type NeedsModel =
  | {
      state: 'ready';
      title: string;
      counts: string;
      empty: string;
      /** Null when nothing needs a person. */
      table: TableModel | null;
    }
  | { state: 'unavailable'; title: string; text: string };

export type CostliestModel = {
  title: string;
  /** The engine's total, as a sentence. */
  sub: string;
  empty: string;
  table: TableModel | null;
  drill?: Drill;
};

export type WarningModel = {
  title: string;
  sub: string;
  /** A sentence that names the machines as chips. */
  headline: Point;
  why: Point[];
  whyLabel: string;
};

/** A machine of the plant's own list: the id a ticket carries, the code the plant reads, and its type. */
export type PlantMachine = { id: string; code: string; category: string | null };

/** What the Dashboard is built from. `open` and `board` are null when their reads failed; `prior` is the reply 30 days earlier. */
export type DashboardFacts = {
  reply: FiguresReply;
  prior?: FiguresReply;
  open: { tickets: readonly Ticket[]; now: string } | null;
  board: ActionCenterBoardReply | null;
  machines: readonly PlantMachine[];
};
