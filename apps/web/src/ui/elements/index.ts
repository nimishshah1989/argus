/**
 * The shared elements of the analytics screens (ticket 83), built on the tokens (81), the meaning map (82) and the
 * chart door (84). A screen takes its words from the catalogue and its figures from `formatFigure`; an element
 * prints them and never invents a colour, a unit or a word of its own.
 */
export { CellPanel, type CellItem } from './cell-panel.js';
export { DataTable, type TableLabels } from './data-table.js';
export { Disclosure } from './disclosure.js';
export { DrillPanel } from './drill-panel.js';
export { DrillTrail, type TrailStep } from './drill-trail.js';
export { GroupedNav, type NavGroup, type NavItem } from './grouped-nav.js';
export { familyStep, RAMP_STEPS, type Family, type RampStep } from './family.js';
export { HeatGrid, type HeatPoint } from './heat-grid.js';
export { InsightBanner } from './insight-banner.js';
export { KpiTile, NO_VALUE } from './kpi-tile.js';
export { PeriodPicker, type DateRange, type Period } from './period-picker.js';
export { RankedList, type RankedItem } from './ranked-list.js';
export { Sparkline } from './sparkline.js';
export { EmptyState, ErrorState, LoadingState } from './states.js';
export { StatusChip } from './status-chip.js';
export {
  MAX_PAGE_ROWS,
  CLIENT_LIMIT,
  nextSort,
  useClientTable,
  type Column,
  type Sort,
  type TableQuery,
  tableView,
} from './table-model.js';
export { Tag, TagGlyph, Tags, type TagSpec } from './tags.js';
export { Timeline, type TimelineEvent } from './timeline.js';
export { TrendDelta } from './trend-delta.js';
