import type { TableModel } from '../../../ui/v2/domain/engine-table.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';

/** One register: the engine's own count, load and age cards, its splits and its lists, with the answer first. */
export type RegisterPageModel = {
  id: string;
  /** The tab: CNC, Conventional, Process, Utilities, DG, Robots. */
  label: string;
  verdict: VerdictData;
  kpis: KpiData[];
  /** The controller and make splits, the by-category table and the machine list, in the platform's order. */
  tables: TableModel[];
};

export type RegistersWords = {
  tabs: string;
  why: string;
};

/** Everything the Machines register prints. The registers that came back, in order; the URL picks one. */
export type RegistersModel = {
  pages: RegisterPageModel[];
  source: string;
  words: RegistersWords;
};
