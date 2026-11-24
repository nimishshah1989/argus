import type { NudgeRule, NudgeSeverity, NudgeStatus } from '@uptimo/shared';
import type { TableWords } from '../../../ui/v2/data-table.js';
import type { AckFormWords } from '../../../ui/v2/domain/ack-form.js';
import type { EntityChipProps } from '../../../ui/v2/entity-chip.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { Point } from '../../../ui/v2/points.js';
import type { Takeaways } from '../../../ui/v2/takeaway.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';

/** What a person can do to one nudge: the three writes on an open one, Reopen on a stored one. */
export type NudgeAction = 'ack' | 'snooze' | 'resolved' | 'reopen';

/** A stored acknowledgement as it prints: who owns it (a person chip when the plant lists them), when due, the note. */
export type NudgeAck = {
  owner: Point;
  /** "Due 20-Nov-2026", or '' when the plant set none. */
  due: string;
  /** "Note: ...", or '' when there is none. */
  note: string;
  /** For a snooze: the day it opens again, DD-MMM-YYYY; '' for the others. */
  until: string;
};

/** One nudge, every field of the engine's board card shown or mapped on purpose. */
export type NudgeRow = {
  /** What the address bar carries (`?drawer=decision:<id>`): the engine key with every database id made a code or a hash. */
  id: string;
  /** The engine's own key, sent back on a write. It holds database ids, so it is never printed, linked or put in a label. */
  writeKey: string;
  rule: NudgeRule;
  severity: NudgeSeverity;
  status: NudgeStatus;
  /** The priority as the engine weighs it (high 3, medium 2, low 1, good news 0): it sorts the column. */
  weight: number;
  ruleLabel: string;
  severityLabel: string;
  /** "Open", "Acknowledged", "Snoozed until 18-Nov-2026" or "Resolved". */
  statusLabel: string;
  /** The engine's sentence, with every machine, cell and person it names as a chip. */
  title: Point;
  /** The same sentence as plain words (a label for a row or a drawer, and what search reads). */
  titleText: string;
  /** Every machine the nudge names, as a chip; one the plant does not list is left out (a dash stands in the sentence). */
  machines: EntityChipProps[];
  count: number;
  entries: string;
  /** The latest entry's plant day, DD-MMM-YYYY, and the number that sorts it; '—' and -1 for a reminder with no evidence. */
  latest: { shown: string; value: number };
  /** "Latest entry 10-Nov-2026", or '' when the reminder has no evidence. */
  latestText: string;
  reopened: boolean;
  excluded: boolean;
  ack: NudgeAck | null;
  actions: NudgeAction[];
  /** What search reads: the sentence, the codes and the type. */
  text: string;
};

/** One "Machines needing attention" row: the machine, the engine's score and the rules that fired. */
export type RiskRow = {
  machine: EntityChipProps | null;
  model: string;
  score: { shown: string; value: number };
  why: string;
  text: string;
};

export type ActionCenterWords = {
  why: string;
  tabsLabel: string;
  priorityLabel: string;
  priorityAll: string;
  typeLabel: string;
  typeAll: string;
  priorities: Record<NudgeSeverity, string>;
  table: TableWords;
  /** What an empty tab says, when the search and priority leave nothing: the Open tab and the others. */
  emptyOpen: string;
  emptyOther: string;
  columns: {
    priority: string;
    nudge: string;
    type: string;
    entries: string;
    latest: string;
    status: string;
  };
  risk: { table: TableWords; machine: string; score: string; why: string };
  detail: { about: string; latest: string; stored: string; actions: string; machines: string };
  /** "Owner", "Due {date}", "Note: {note}", "No owner set" and the two marks, ready to print. */
  owner: string;
  ownerNone: string;
  reopened: string;
  excluded: string;
  actions: { acknowledge: string; snooze: string; resolve: string; reopen: string };
  form: AckFormWords;
  saveFailed: string;
};

/** Everything the Action Center prints, and what the API fills: words and figures arrive ready to print. */
export type ActionCenterModel = {
  verdict: VerdictData;
  /** The four priority counts, open nudges only, as the engine counted them. */
  kpis: KpiData[];
  tabs: { key: NudgeStatus; label: string; count: number }[];
  /** All sixteen kinds, in the engine's order. */
  types: { key: NudgeRule; label: string }[];
  /** Every nudge in the engine's order (priority, then the latest evidence first). */
  nudges: NudgeRow[];
  risk: RiskRow[];
  /** Each table's computed line, `nudges` (open nudges by kind) and `risk` (ADR 0035, ticket 654). */
  takeaways?: Takeaways;
  /** The people an owner can be chosen from (active only), as the plant lists them. */
  people: string[];
  snoozeDays: number;
  source: string;
  words: ActionCenterWords;
};

/** What the reader asks of the page; a write is the server's, and the page reads again when it answers. */
export type ActionCenterActions = {
  onAck?: (writeKey: string, body: { owner: string; due: string; note: string }) => void;
  onSnooze?: (writeKey: string) => void;
  onResolve?: (writeKey: string) => void;
  onReopen?: (writeKey: string) => void;
  /** True while a write is on its way, and the engine key of the nudge whose last write failed (shown on that nudge only). */
  saving?: boolean;
  failedKey?: string | null;
};
