import type { ActionCenterBoardReply } from '@uptimo/shared';
import type { FiguresReply } from '@uptimo/shared/analytics';
import type { Ticket } from '../../../api.js';
import type { ChartSpec } from '../../../ui/chart/use-chart.js';
import type { TableModel } from '../../../ui/v2/domain/engine-table.js';
import type { Strip } from '../../../ui/v2/action-strip.js';
import type { BannerTone } from '../../../ui/v2/banner.js';
import type { BubbleDot, BubbleWords } from '../../../ui/v2/bubble-plot.js';
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
  actionCenter: BannerModel | null;
  /** This month's Team Focus actions still open, and the top one, with the way in; none when none is open. */
  teamFocus: BannerModel | null;
  /** The page's action strips (the kit drops the empty ones). */
  strips: Strip[];
  /** The engine's figures as cards, in three groups; the first card of a `hero` group is the lead figure. */
  sections: { id: string; title: string; sub: string; hero: boolean; kpis: KpiData[] }[];
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

/** A banner across the page: what it says, how loud (a tone and its word) and where it goes. */
export type BannerModel = {
  title: string;
  text: string;
  open: string;
  href: string;
  tone: BannerTone;
  /** The tone in words, so the colour never stands alone; null for a quiet banner. */
  tag: string | null;
};

/** The age bands of Bhavin's bubble filter: 0-5, 5-10, 10-15, 15-20, 20 and over, and no known age. */
export type AgeBand = '0' | '1' | '2' | '3' | '4' | 'u';

/** One machine on the bubble chart, with what its filters read: the machine's type, its cell today and its age band. */
export type BubbleMachine = BubbleDot & {
  category: string | null;
  cell: string | null;
  band: AgeBand;
};

/** The bubble chart as it is explored: every machine and the words of its controls. A bubble wears its machine type's colour, as the code chips do. */
export type BubbleModel = {
  dots: BubbleMachine[];
  words: BubbleWords & {
    all: string;
    cell: string;
    category: string;
    age: string;
    resetFilters: string;
    /** `{n}` machines shown. */
    shown: string;
    bands: { key: AgeBand; label: string }[];
  };
};

/** A picture, or the line that stands where it would be (not computed yet, or nothing recorded). */
export type ChartModel = { id: string; title: string } & (
  | { spec: ChartSpec; sub: string; aria: string; drill?: Drill }
  | { bubble: BubbleModel; sub: string; aria: string; drill?: Drill }
  | { note: string }
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
  /** The way to the full analysis of these problems. */
  link: { href: string; label: string };
};

export type WarningModel = {
  title: string;
  sub: string;
  /** A sentence that names the machines as chips. */
  headline: Point;
  /** The machines past the ones the headline names, behind "and N more"; none when the headline names them all. */
  more: { label: string; rest: Point } | null;
  why: Point[];
  whyLabel: string;
};

/** A machine of the plant's own list: the id a ticket carries, the code the plant reads, its type and its cell today. */
export type PlantMachine = {
  id: string;
  code: string;
  category: string | null;
  cell?: string | null;
};

/** What the Dashboard is built from. `open` and `board` are null when their reads failed; `prior` is the reply 30 days earlier. */
export type DashboardFacts = {
  reply: FiguresReply;
  prior?: FiguresReply;
  open: { tickets: readonly Ticket[]; now: string } | null;
  board: ActionCenterBoardReply | null;
  machines: readonly PlantMachine[];
};
