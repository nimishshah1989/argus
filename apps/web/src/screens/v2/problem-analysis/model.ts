import type { ChartSpec } from '../../../ui/chart/use-chart.js';
import type { TableWords } from '../../../ui/v2/data-table.js';
import type { FigureData } from '../../../ui/v2/figure-tile.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';
import type { PrintedTable } from '../printed-page/table.js';

/** A chart the engine sent, with the two lines the screen says about it. */
export type ProblemChart = { id: string; spec: ChartSpec; sub: string; aria: string };

export type ProblemAnalysisWords = {
  why: string;
  all: string;
  /** The header over the platform's Accept and remove buttons, which it printed without one. */
  accept: string;
  remove: string;
  editorTitle: string;
  /** `{label}`, `{value}`, `{sub}`: the figure the page opens on, as one quiet line. */
  context: string;
  /** The row of four figures that answer "what if the top problem were cut". */
  whatIf: string;
  table: TableWords;
  /** `{n}`: how many bars or bubbles the chart draws. */
  charts: { bar: { sub: string; aria: string }; scatter: { sub: string; aria: string } };
  /** `{studied}` and `{top}`: the verdict. */
  headline: string;
  /** Said when the engine printed too few figures to name the top problem. */
  noFigures: string;
  /** `{date}`: the line under the page. */
  source: string;
  /** Said above the group list: it is read-only until editing the groups is built. */
  editorReadOnly: string;
};

/** Everything Problem Analysis prints: the engine's page, whole, in the reader's words, ready to print. */
export type ProblemAnalysisModel = {
  verdict: VerdictData;
  /** The four figures of the page, then the four of the what-if. */
  studied: FigureData[];
  whatIf: FigureData[];
  charts: ProblemChart[];
  groups: PrintedTable | null;
  families: PrintedTable | null;
  repeats: PrintedTable | null;
  unplaced: PrintedTable | null;
  unrecognised: PrintedTable | null;
  editor: PrintedTable | null;
  source: string;
  words: ProblemAnalysisWords;
};
