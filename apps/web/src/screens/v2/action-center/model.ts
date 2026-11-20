import type { NudgeRule, NudgeSeverity, NudgeStatus } from '@uptimo/shared';
import type { TableWords } from '../../../ui/v2/data-table.js';
import type { NudgeFormWords } from '../../../ui/v2/domain/nudge-controls.js';
import type { EntityChipProps } from '../../../ui/v2/entity-chip.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';

/** What a card can do: the three writes on an open nudge, Reopen on one that was dealt with. */
export type NudgeAction = 'ack' | 'snooze' | 'resolved' | 'reopen';

/** One nudge as the board holds it, ready to print. */
export type NudgeCard = {
  key: string;
  rule: NudgeRule;
  severity: NudgeSeverity;
  /** The nudge type in the reader's words. */
  type: string;
  title: string;
  machines: EntityChipProps[];
  /** "12 entries". */
  entries: string;
  /** "Latest entry 10-Nov-2026"; empty for a reminder with no evidence. */
  evidence: string;
  reopened: boolean;
  excluded: boolean;
  status: NudgeStatus;
  /** What was done to it: the status, the owner, the due day and the note, each its own phrase. */
  saved: string[];
  actions: NudgeAction[];
};

/** One of "Machines needing attention": the engine's score is printed as it came and also places the sort. */
export type RiskRow = {
  machine: EntityChipProps;
  model: string;
  score: { shown: string; value: number };
  why: string;
};

export type ActionCenterWords = {
  why: string;
  /** The status tabs' group label. */
  tabsLabel: string;
  nudgesTitle: string;
  priorityLabel: string;
  allPriorities: string;
  typeLabel: string;
  allTypes: string;
  search: string;
  /** Already says its days: "Snooze 7 days". */
  snooze: string;
  acknowledge: string;
  resolve: string;
  reopen: string;
  reopened: string;
  excluded: string;
  saveFailed: string;
  emptyOpen: string;
  empty: string;
  form: NudgeFormWords;
  risk: TableWords & {
    columns: { machine: string; score: string; why: string };
    all: string;
  };
};

/**
 * Everything the Action Center prints, and the contract the board fills: the four priority counts, the machines that
 * need attention, and every nudge with its status. Filtering (status, priority, type, search) is the reader's, in the
 * view; the order is the engine's.
 */
export type ActionCenterModel = {
  verdict: VerdictData;
  /** One card per priority, in the platform's order. */
  tiles: KpiData[];
  tabs: { status: NudgeStatus; label: string; count: number }[];
  priorities: { key: NudgeSeverity; label: string }[];
  types: { key: NudgeRule; label: string }[];
  risk: RiskRow[];
  nudges: NudgeCard[];
  /** The people an acknowledgement may name. */
  people: { id: string; name: string }[];
  /** The priority headings. */
  severityLabels: Record<NudgeSeverity, string>;
  source: string;
  words: ActionCenterWords;
};

/** What the reader asks for; the page sends it to the server and brings the fresh board back. */
export type ActionCenterActions = {
  onAcknowledge?: (key: string, values: { owner: string; due: string; note: string }) => void;
  onSnooze?: (key: string) => void;
  onResolve?: (key: string) => void;
  onReopen?: (key: string) => void;
};
