import type { Drill } from '../../../ui/v2/drill.js';
import type { HeatMatrixData, HeatWords } from '../../../ui/v2/domain/heat-matrix.js';
import type { FigureData } from '../../../ui/v2/figure-tile.js';
import type { Takeaways } from '../../../ui/v2/takeaway.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';
import type { PageChart, PageWords } from '../printed-page/page-model.js';
import type { PrintedTable } from '../printed-page/table.js';

/** One of the engine's four shift-calendar figures: its title, its figures, charts, tables and heat grids, as printed. */
export type ShiftSection = {
  id: string;
  title: string;
  figures: FigureData[];
  charts: PageChart[];
  tables: PrintedTable[];
  heat: HeatMatrixData[];
  /** The engine has not computed this figure: the section says so and shows nothing else. */
  notComputed?: true;
  /** The rows behind the section's figure, as a page action; absent when a figure's own count carries the drill. */
  drill?: Drill;
};

/** Everything the Shift-calendar KPIs print: the answer, then the four figures of the screen in the engine's order. */
export type ShiftModel = {
  verdict: VerdictData;
  /** The line each section opens with, by section id; null when a section has nothing to say (the comparison has none). */
  takeaways: Takeaways;
  sections: ShiftSection[];
  source: string;
  words: PageWords & { heat: HeatWords; heatCell: string; noHours: string; notComputed: string };
};
