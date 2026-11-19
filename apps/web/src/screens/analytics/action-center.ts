import {
  NUDGE_RULES,
  NUDGE_SEVERITIES,
  NUDGE_STATUSES,
  type ActionCenterBoardReply,
  type BoardNudgeReply,
  type NudgeRule,
  type NudgeSeverity,
  type NudgeStatus,
} from '@uptimo/shared';
import type { MessageKey } from '@uptimo/shared/i18n';

/**
 * The Action Center's pure board-to-view mapping (ticket 44, packet 44d). The server sends the board; this
 * module turns it into the words the screen prints, with no fetching and no React: the mapping test reads the
 * frozen key beside a board literal. It never invents a number, never re-sorts the engine's order and carries
 * no money (the spares nudge's rupees never enter the screen).
 */

/** The four priority headings, in the platform's order. */
export const SEVERITY_ORDER: readonly NudgeSeverity[] = NUDGE_SEVERITIES;

/** The four status tabs, in the platform's order: Open first. */
export const TAB_ORDER: readonly NudgeStatus[] = NUDGE_STATUSES;

export const SEVERITY_LABELS: Record<NudgeSeverity, MessageKey> = {
  high: 'analytics.actionCenter.tile.high',
  med: 'analytics.actionCenter.tile.med',
  low: 'analytics.actionCenter.tile.low',
  info: 'analytics.actionCenter.tile.info',
};

/** The words for each nudge type, so Gujarati readers do not see the server's English map. */
export const RULE_LABELS: Record<NudgeRule, MessageKey> = {
  recur: 'analytics.actionCenter.rule.recur',
  freq: 'analytics.actionCenter.rule.freq',
  rise: 'analytics.actionCenter.rule.rise',
  cell: 'analytics.actionCenter.rule.cell',
  long: 'analytics.actionCenter.rule.long',
  spike: 'analytics.actionCenter.rule.spike',
  good: 'analytics.actionCenter.rule.good',
  mttr: 'analytics.actionCenter.rule.mttr',
  hum: 'analytics.actionCenter.rule.hum',
  shift: 'analytics.actionCenter.rule.shift',
  team: 'analytics.actionCenter.rule.team',
  newm: 'analytics.actionCenter.rule.newm',
  spares: 'analytics.actionCenter.rule.spares',
  age: 'analytics.actionCenter.rule.age',
  amc: 'analytics.actionCenter.rule.amc',
  legal: 'analytics.actionCenter.rule.legal',
};

export const TAB_LABELS: Record<NudgeStatus, MessageKey> = {
  open: 'analytics.actionCenter.tab.open',
  ack: 'analytics.actionCenter.tab.ack',
  snoozed: 'analytics.actionCenter.tab.snoozed',
  resolved: 'analytics.actionCenter.tab.resolved',
};

/** The buttons one card offers: the three writes on an open nudge, Reopen on a stored one. */
export type CardAction = 'ack' | 'snooze' | 'resolved' | 'reopen';

export interface CardMachine {
  id: string;
  /** The machine's code for the chip; the board names ids, so the screen resolves the code it knows. */
  label: string;
  /** The machine's own page, the face's one machine drill. */
  href: string;
}

/** A stored ack as the card prints it: the owner, the due and until plant dates, and the note. */
export interface CardAck {
  owner: string;
  due: string;
  note: string;
  until: string;
}

export interface NudgeCard {
  key: string;
  rule: NudgeRule;
  severity: NudgeSeverity;
  type: string;
  title: string;
  machines: CardMachine[];
  entries: number;
  /** The latest entry's plant day as DD-MM-YYYY; '' when the reminder has no evidence. */
  evidence: string;
  excluded: boolean;
  reopened: boolean;
  status: NudgeStatus;
  ack: CardAck | null;
  actions: CardAction[];
}

export interface ActionTile {
  severity: NudgeSeverity;
  label: MessageKey;
  count: number;
}

export interface ActionTab {
  status: NudgeStatus;
  label: MessageKey;
  count: number;
}

export interface ActionTypeOption {
  rule: NudgeRule;
  label: string;
}

export interface ActionRiskRow {
  machine: string;
  model: string;
  /** The machine cell the page prints: the id, a space, the model, trailing space trimmed. */
  label: string;
  score: string;
  why: string;
  href: string;
}

export interface ActionCenterView {
  /** The board's as-of plant day as DD-MM-YYYY. */
  asOf: string;
  snoozeDays: number;
  tiles: ActionTile[];
  tabs: ActionTab[];
  types: ActionTypeOption[];
  cards: NudgeCard[];
  risk: ActionRiskRow[];
}

export interface CardFilters {
  status: NudgeStatus;
  severity: NudgeSeverity | '';
  rule: NudgeRule | '';
  query: string;
}

export interface SeverityGroup {
  severity: NudgeSeverity;
  labelKey: MessageKey;
  cards: NudgeCard[];
}

/** The platform's plant-day boundary for an ISO instant: the date the plant was on, not the browser's. */
export function plantDayOf(instant: string, timeZone: string): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** A plant day (YYYY-MM-DD) as the platform prints it (DD-MM-YYYY); '' for no date. */
export function dmy(day: string | null): string {
  if (day === null || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';
  const [year, month, date] = day.split('-');
  return `${date}-${month}-${year}`;
}

export function machineHref(id: string): string {
  return `/analytics/machines/${encodeURIComponent(id)}`;
}

/** What one card can do: info has none, a stored status only reopens, an open nudge takes the three writes. */
function actionsOf(nudge: BoardNudgeReply): CardAction[] {
  if (nudge.sev === 'info') return [];
  if (nudge.status !== 'open') return ['reopen'];
  return ['ack', 'snooze', 'resolved'];
}

function ackOf(nudge: BoardNudgeReply, timeZone: string): CardAck | null {
  const ack = nudge.ack;
  if (ack === null) return null;
  return {
    owner: ack.owner,
    due: dmy(ack.due === '' ? null : ack.due),
    note: ack.note,
    until: ack.until === undefined ? '' : dmy(plantDayOf(ack.until, timeZone)),
  };
}

function cardOf(
  nudge: BoardNudgeReply,
  types: ActionCenterBoardReply['types'],
  timeZone: string,
  labelOf: (id: string) => string,
): NudgeCard {
  return {
    key: nudge.key,
    rule: nudge.rule,
    severity: nudge.sev,
    type: types[nudge.rule] ?? nudge.rule,
    title: nudge.title,
    machines: nudge.machines.map((id) => ({ id, label: labelOf(id), href: machineHref(id) })),
    entries: nudge.entries,
    evidence: dmy(nudge.ev),
    excluded: nudge.excluded,
    reopened: nudge.reopened,
    status: nudge.status,
    ack: ackOf(nudge, timeZone),
    actions: actionsOf(nudge),
  };
}

function riskOf(board: ActionCenterBoardReply, labelOf: (id: string) => string): ActionRiskRow[] {
  return board.risk.map((row) => ({
    machine: row.machine,
    model: row.model,
    label: `${labelOf(row.machine)} ${row.model}`.trim(),
    score: String(row.score),
    why: row.why,
    href: machineHref(row.machine),
  }));
}

/**
 * The whole board as the screen reads it, in the engine's own order. `labelOf` resolves a machine id to its
 * code; it defaults to the id so the key, whose ids are its codes, reads exactly.
 */
export function actionCenterView(
  board: ActionCenterBoardReply,
  timeZone: string,
  labelOf: (id: string) => string = (id) => id,
): ActionCenterView {
  return {
    asOf: dmy(board.asOf),
    snoozeDays: board.snoozeDays,
    tiles: SEVERITY_ORDER.map((severity) => ({
      severity,
      label: SEVERITY_LABELS[severity],
      count: board.bySeverity[severity],
    })),
    tabs: TAB_ORDER.map((status) => ({
      status,
      label: TAB_LABELS[status],
      count: board.counts[status],
    })),
    types: NUDGE_RULES.map((rule) => ({ rule, label: board.types[rule] ?? rule })),
    cards: board.nudges.map((nudge) => cardOf(nudge, board.types, timeZone, labelOf)),
    risk: riskOf(board, labelOf),
  };
}

/** The cards one tab, priority, type and search leave: a stable filter, never a sort. */
export function filterCards(cards: readonly NudgeCard[], filters: CardFilters): NudgeCard[] {
  const query = filters.query.trim().toLowerCase();
  return cards.filter((card) => {
    if (card.status !== filters.status) return false;
    if (filters.severity !== '' && card.severity !== filters.severity) return false;
    if (filters.rule !== '' && card.rule !== filters.rule) return false;
    if (query === '') return true;
    const haystack = `${card.title} ${card.machines
      .map((machine) => `${machine.id} ${machine.label}`)
      .join(' ')}`;
    return haystack.toLowerCase().includes(query);
  });
}

/** The cards under their priority headings, high first; a priority with no card prints no heading. */
export function severityGroups(cards: readonly NudgeCard[]): SeverityGroup[] {
  return SEVERITY_ORDER.flatMap((severity) => {
    const found = cards.filter((card) => card.severity === severity);
    return found.length === 0
      ? []
      : [{ severity, labelKey: SEVERITY_LABELS[severity], cards: found }];
  });
}

/** The Dashboard banner's two counts, or null when no nudge is open (the platform hides it then). */
export function bannerOf(board: ActionCenterBoardReply): { high: number; medium: number } | null {
  if (board.counts.open === 0) return null;
  return { high: board.bySeverity.high, medium: board.bySeverity.med };
}
