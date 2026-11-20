import type { ChartSpec } from '../../../ui/chart/use-chart.js';
import type { Drill } from '../../../ui/v2/drill.js';
import type { HeatWords } from '../../../ui/v2/domain/heat-matrix.js';
import type { HeatTileData } from '../../../ui/v2/domain/heat-tiles.js';
import type { FigureData } from '../../../ui/v2/figure-tile.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';

/** One of the three maps: the plant's load by cell, by location, or the average per machine in each cell. */
export type EnergyGridModel = {
  id: 'cell' | 'location' | 'machine';
  title: string;
  /** What the map shows and how to read a tile, in the platform's own words. */
  sub: string;
  /** Connected beside running load, tile by tile; none for the per-machine map, which has no running line. */
  chart: { spec: ChartSpec; sub: string; aria: string } | null;
  tiles: HeatTileData[];
};

/** Everything the Energy screen prints: the answer, the plant's load, the three maps and the rows behind the figure. */
export type EnergyModel = {
  verdict: VerdictData;
  figures: FigureData[];
  grids: EnergyGridModel[];
  /** The machines behind the whole figure, opened from a page action (v1 linked them below the maps). */
  drill?: Drill;
  source: string;
  words: { why: string; heat: HeatWords };
};
