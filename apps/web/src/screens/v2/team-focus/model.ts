import type { TableWords } from '../../../ui/v2/data-table.js';
import type { DecisionDetailWords } from '../../../ui/v2/domain/decision-detail.js';
import type { DecisionListWords } from '../../../ui/v2/domain/decision-list.js';
import type { DecisionData, DecisionKind } from '../../../ui/v2/domain/decision-row.js';
import type { EntityChipProps } from '../../../ui/v2/entity-chip.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { Point } from '../../../ui/v2/points.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';

export type ActionStatus = 'todo' | 'doing' | 'done' | 'skip';
/** How loaded someone is: over the line, within it, or with room for more. */
export type Load = 'over' | 'ok' | 'room';

/** One planned action of the month, as the full list prints it. */
export type ActionRow = {
  id: string;
  kind: DecisionKind;
  kindLabel: string;
  title: string;
  /** The machines it is about; a row opens the first of them. */
  chips: EntityChipProps[];
  /** Who has it, or nobody yet. */
  owner: EntityChipProps | null;
  status: ActionStatus;
  statusLabel: string;
  /** Breakdown hours a month it wins back: the engine's figure, and the number that sorts it. */
  hours: { shown: string; value: number };
};

/** One person and what they carry. */
export type PersonLoad = {
  chip: EntityChipProps;
  role: string;
  open: number;
  hours: { shown: string; value: number };
  done: number;
  load: Load;
  loadLabel: string;
};

/** What to move off the overloaded, as the engine proposes it; `done` is whether it has been taken. */
export type Rebalance = {
  title: string;
  points: Point[];
  action: string;
  doneText: string;
  done: boolean;
};

/**
 * Everything Team Focus prints, and the contract the API fills. Every figure and word arrives ready to print; the
 * screen arranges them. The numbers beside a printed figure (`hours.value`, `open`) only place a mark or sort a column.
 */
export type TeamFocusModel = {
  verdict: VerdictData;
  /** Two to four key figures. */
  kpis: KpiData[];
  /** Open actions nobody owns, biggest first, each ending in the owner the engine suggests. */
  start: DecisionData[];
  people: PersonLoad[];
  /** Null when nobody is over the line. */
  rebalance: Rebalance | null;
  /** Every action of the month. */
  actions: ActionRow[];
  /** Where the figures came from and how fresh they are (DD-MMM-YYYY, IST). */
  source: string;
  words: TeamFocusWords;
};

export type TeamFocusWords = {
  why: string;
  /** Said under "Needs an owner" when every open action has one. */
  allOwned: string;
  decisions: DecisionListWords;
  decisionDetail: DecisionDetailWords;
  peopleTitle: string;
  people: TableWords & {
    columns: { person: string; open: string; hours: string; done: string; load: string };
    filters: { all: string; over: string; room: string };
  };
  actions: TableWords & {
    columns: { action: string; owner: string; status: string; hours: string };
    filters: { all: string; noOwner: string; doing: string; done: string };
    noOwner: string;
  };
};

/** What the reader asks for; nothing goes to the network in the gallery. */
export type TeamFocusActions = {
  onAssign?: (actionId: string) => void;
  onUnassign?: (actionId: string) => void;
  onRebalance?: () => void;
};
