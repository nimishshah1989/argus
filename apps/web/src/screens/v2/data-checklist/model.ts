import type { CheckData, CheckWords } from '../../../ui/v2/domain/check-row.js';
import type { Drill } from '../../../ui/v2/drill.js';
import type { TableWords } from '../../../ui/v2/data-table.js';
import type { EntityChipProps } from '../../../ui/v2/entity-chip.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { Point } from '../../../ui/v2/points.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';

/** The checks of one part of the data, with the person who fixes what fails there. */
export type CheckGroup = {
  id: string;
  /** "Breakdown log", "Machine records": the part of the data, in the reader's words. */
  name: string;
  /** "2 gaps · 1 check", as printed. */
  summary: string;
  owner: EntityChipProps;
  /** Only the checks that need someone, gaps first. */
  checks: CheckData[];
};

/** One record that needs fixing: the machine or person it is about opens in the drawer. */
export type RecordRow = {
  id: string;
  /** What the row is about: a machine (or a person) chip. */
  entity: EntityChipProps;
  /** What is wrong with it, in words. */
  what: string;
  /** The part of the data it belongs to, and the key the filter chips match. */
  area: { key: string; label: string };
  owner: EntityChipProps;
  /** How long it has been open: as printed, and the number that sorts it. */
  open: { shown: string; value: number };
};

/**
 * Everything the Data Checklist prints, and the contract the API fills: whether the figures can be trusted, the
 * checks that fail by owner, every record to fix, and the checks that pass. Words and figures arrive ready to print.
 */
export type DataChecklistModel = {
  verdict: VerdictData;
  /**
   * v1's "See the rows": the page's own control for the tickets behind the breakdown and Why-Why gaps (engine
   * `drillIds`). Only when the engine named any; never on a card, since no card counts exactly those tickets (ADR 0019).
   */
  drill?: Drill;
  /** Two to four key figures. */
  kpis: KpiData[];
  /** Parts of the data that have something to fix, the one with the most gaps first. */
  groups: CheckGroup[];
  /** Every record behind those checks. */
  records: RecordRow[];
  /** The checks that pass, one sentence each; "everything is ready" when nothing fails. */
  passing: Point[];
  /** Where the figures came from and how fresh they are (DD-MMM-YYYY, IST). */
  source: string;
  words: DataChecklistWords;
};

export type DataChecklistWords = {
  why: string;
  check: CheckWords;
  /** Said under the title when no check fails. */
  allClear: string;
  passingTitle: string;
  /** `{n}` checks pass, under the title. */
  passingSub: string;
  /** Shown beside a group's title, before its owner. */
  ownerIs: string;
  records: TableWords & {
    columns: { record: string; area: string; owner: string; open: string };
    /** The filter chips: all, then one per part of the data. */
    all: string;
  };
};

/** What the reader asks for; nothing goes to the network in the gallery. A check's state comes back in the model. */
export type DataChecklistActions = {
  onFix?: (checkId: string) => void;
  onUndo?: (checkId: string) => void;
};
