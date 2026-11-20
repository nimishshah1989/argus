import type { EntityChipProps } from '../../../ui/v2/entity-chip.js';
import type { IconName } from '../../../ui/v2/icons.js';
import type { PillTone } from '../../../ui/v2/key-pill.js';
import type { MachineData, MachineState } from '../../../ui/v2/domain/plant.js';
import type { Point } from '../../../ui/v2/points.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { TableWords } from '../../../ui/v2/data-table.js';
import type { TrendData } from '../../../ui/v2/trend-chart.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';

/** A small tag on a breakdown or a part: a word on a tint of its meaning, with an icon when it names a state. */
export type Tag = { text: string; tone: PillTone; icon?: IconName };

/** One breakdown of this machine, ready to print. `days` (days before today) only sorts and filters. */
export type BreakdownRow = {
  key: string;
  days: number;
  date: { shown: string; iso: string };
  problem: string;
  /** Who fixed it (or is fixing it): a person chip. */
  who: EntityChipProps;
  hours: { shown: string; value: number };
  tags: Tag[];
  flags: { repeat: boolean; waited: boolean; open: boolean };
  /** The story behind the row, for the panel it opens. */
  story: Point[];
};

/** What to do next, in one card; `action` is missing when there is nothing to do. */
export type NextAction = {
  title: Point;
  why: Point[];
  action?: string;
  doneText?: string;
};

export type PmData = {
  /** Next PM, PM hours this month, PMs done on the day. */
  figures: { label: string; value: string; note?: string }[];
  tag: Tag;
  /** The last visits, newest first. */
  visits: Point[];
};

export type SparesData = {
  tag: Tag;
  /** One sentence per part: stock, and what it was used in. */
  parts: Point[];
};

export type HistoryWords = TableWords & {
  columns: { date: string; problem: string; who: string; hours: string; result: string };
  filters: { all: string; last90: string; repeat: string; waited: string };
  /** `{date}` and `{problem}` of the breakdown that is open. */
  detailTitle: string;
  close: string;
};

export type MachinePageWords = {
  why: string;
  states: Record<MachineState, string>;
  nextTitle: string;
  undo: string;
  pmTitle: string;
  sparesTitle: string;
  historySub: string;
  history: HistoryWords;
};

/**
 * Everything the Machine page prints for one machine, and the contract the API fills. The machine is the same
 * `MachineData` the plant map and the machine drawer read, so the page and the drawer agree.
 */
export type MachinePageModel = {
  machine: MachineData;
  verdict: VerdictData;
  kpis: KpiData[];
  next: NextAction;
  trend: TrendData;
  pm: PmData;
  spares: SparesData;
  /** Newest first, the last 12 months. */
  history: BreakdownRow[];
  source: string;
  words: MachinePageWords;
};
