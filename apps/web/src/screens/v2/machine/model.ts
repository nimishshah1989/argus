import type { Drill } from '../../../ui/v2/drill.js';
import type { EntityChipProps } from '../../../ui/v2/entity-chip.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { Takeaways } from '../../../ui/v2/takeaway.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';
import type { TableModel } from '../figures/table.js';

/** A label over its value, with a quiet line under it for what is not the value (a basis, why it is missing). */
export type Fact = { id: string; label: string; value: string; note?: string };

/** What a block with rows to open says: its title, its facts or lines, and the way to the rows behind it. */
export type Block = { title: string; drill?: Drill };

/** The reliability fit as the page prints it: the basis, three figures, the sample, the quartiles, the trend word. */
export type FitModel = {
  heading: string | null;
  figures: Fact[];
  /** The basis, sample, quartile and shortfall sentences, in reading order. */
  lines: string[];
  trend: { word: string; slope: string } | null;
};

/** One open task or PM job: its reference (the way to the desk), the problem, its status and, for PM, its day. */
export type TaskRow = {
  id: string;
  ref: string;
  problem: string;
  scheduled: string | null;
  overdue: string | null;
  status: string;
  href: string;
};

/**
 * Everything the Machine page prints for one machine, from the engine's `machine-page` and `reliability` figures, the
 * plant's list and the machine's open tickets. A fact the plant never recorded is left out or says so; it is never a
 * zero and never a guess.
 */
export type MachinePageModel = {
  machine: {
    id: string;
    code: string;
    chip: EntityChipProps;
    type: string;
    cell: EntityChipProps | null;
  };
  verdict: VerdictData;
  /** Age, floor area, the two loads, breakdowns, breakdown hours, MTTR and PM hours. */
  kpis: KpiData[];
  breakdowns: Block & { facts: Fact[] };
  reliability: Block & { note: string | null; fit: FitModel | null };
  spares: Block & {
    note: string | null;
    ranked: string;
    table: TableModel | null;
    /** "15 parts, 5 shown"; null when every part is shown. */
    topLine: string | null;
  };
  tasks: Block & {
    asOf: string;
    /** Why the lists cannot be read, or null when they can. */
    unavailable: string | null;
    open: { title: string; empty: string; rows: TaskRow[] };
    pm: { title: string; empty: string; rows: TaskRow[] };
  };
  moves: Block & { table: TableModel | null; none: string };
  nameplate: Block & { facts: Fact[]; none: string };
  pm: Block & { facts: Fact[] };
  completeness: Block & { fact: Fact };
  /** One line each for `machine.spares` and `machine.tasks` (ADR 0031 §5). */
  takeaways: Takeaways;
  source: string;
  words: { why: string; seeRows: string };
};
