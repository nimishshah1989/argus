import {
  NUDGE_RULES,
  NUDGE_SEVERITIES,
  NUDGE_STATUSES,
  type ActionCenterBoardReply,
  type BoardNudgeReply,
  type NudgeSeverity,
  type NudgeStatus,
} from '@uptimo/shared';
import { fill } from '../../../i18n/fill.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { Point } from '../../../ui/v2/points.js';
import type { Takeaways } from '../../../ui/v2/takeaway.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';
import { plantDayOf } from '../../analytics/action-center.js';
import { dayText, machineChip, sourceLine, type Translate } from '../figures/read.js';
import { takeawayFor, type Item } from '../insight.js';
import type {
  ActionCenterModel,
  ActionCenterWords,
  NudgeAck,
  NudgeAction,
  NudgeRow,
  RiskRow,
} from './model.js';
import { nudgeRef, plainTitle, slugOf, titlePoint, type Names } from './text.js';

/** What the plant knows: the engine's board, its machines and people, and the zone its days are told in. */
export type BoardFacts = {
  board: ActionCenterBoardReply;
  machines: readonly { id: string; code: string; category: string | null }[];
  people: readonly { id: string; name: string; active: boolean }[];
  timeZone: string;
};

const WEIGHT: Record<NudgeSeverity, number> = { high: 3, med: 2, low: 1, info: 0 };
const KPI_ICON = { high: 'alert', med: 'clock', low: 'list', info: 'check' } as const;
const DAY_MS = 86_400_000;

/** What a card can do: good news has no button, a stored status only reopens, an open nudge takes the three writes. */
function actionsOf(nudge: BoardNudgeReply): NudgeAction[] {
  if (nudge.sev === 'info') return [];
  return nudge.status === 'open' ? ['ack', 'snooze', 'resolved'] : ['reopen'];
}

const dayNumber = (day: string | null): number =>
  day === null ? -1 : Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS);

/** The plant's lists as the chips and sentences need them: a code for an id, a chip for a machine, a person, a cell. */
function namesOf(facts: BoardFacts, t: Translate): Names {
  const byId = new Map(facts.machines.map((m) => [m.id, m]));
  const byCode = new Map(facts.machines.map((m) => [m.code, m]));
  const people = new Map(facts.people.map((p) => [p.name.trim().toLowerCase(), p]));
  return {
    codeOf: (id) => byId.get(id)?.code ?? null,
    machine: (code) => machineChip(code, byCode.get(code)?.category ?? undefined),
    person: (name) => {
      const person = people.get(name.trim().toLowerCase());
      return person ? { kind: 'person', id: slugOf(person.name), label: person.name } : null;
    },
    cell: (name) => ({ kind: 'cell', id: name, label: name }),
    dash: t('v2m.none'),
  };
}

/** A stored acknowledgement as it prints; the owner is a person's chip when the plant lists them. */
function ackOf(
  nudge: BoardNudgeReply,
  names: Names,
  facts: BoardFacts,
  t: Translate,
): NudgeAck | null {
  const ack = nudge.ack;
  if (ack === null) return null;
  const chip = ack.owner === '' ? null : names.person(ack.owner);
  const owner: Point = chip
    ? [{ text: chip.label, entity: chip }]
    : ack.owner === ''
      ? []
      : [{ text: ack.owner }];
  return {
    owner,
    due: ack.due === '' ? '' : t('analytics.actionCenter.due', { date: dayText(ack.due) }),
    note: ack.note === '' ? '' : t('analytics.actionCenter.note', { note: ack.note }),
    until: ack.until === undefined ? '' : dayText(plantDayOf(ack.until, facts.timeZone)),
  };
}

const STATUS_KEY = {
  open: 'analytics.actionCenter.tab.open',
  ack: 'analytics.actionCenter.status.ack',
  snoozed: 'analytics.actionCenter.tab.snoozed',
  resolved: 'analytics.actionCenter.status.resolved',
} as const;

/** "Open", "Acknowledged", "Snoozed until 18-Nov-2026" (the day it opens again) or "Resolved". */
function statusLabel(status: NudgeStatus, ack: NudgeAck | null, t: Translate): string {
  if (status === 'snoozed' && ack?.until)
    return t('analytics.actionCenter.status.snoozed', { date: ack.until });
  return t(STATUS_KEY[status]);
}

function rowOf(nudge: BoardNudgeReply, facts: BoardFacts, names: Names, t: Translate): NudgeRow {
  const title = titlePoint(nudge, names);
  const titleText = plainTitle(nudge.title, nudge.machines, names);
  const ack = ackOf(nudge, names, facts, t);
  const codes = nudge.machines.flatMap((id) => names.codeOf(id) ?? []);
  const ruleLabel = t(`analytics.actionCenter.rule.${nudge.rule}`);
  return {
    id: nudgeRef(nudge.key, names.codeOf),
    writeKey: nudge.key,
    rule: nudge.rule,
    severity: nudge.sev,
    status: nudge.status,
    weight: WEIGHT[nudge.sev],
    ruleLabel,
    severityLabel: t(`analytics.actionCenter.tile.${nudge.sev}`),
    statusLabel: statusLabel(nudge.status, ack, t),
    title,
    titleText,
    machines: codes.map(names.machine),
    count: nudge.entries,
    entries: t('analytics.actionCenter.entries', { count: nudge.entries }),
    latest: {
      shown: nudge.ev === null ? names.dash : dayText(nudge.ev),
      value: dayNumber(nudge.ev),
    },
    latestText:
      nudge.ev === null ? '' : t('analytics.actionCenter.latestEntry', { date: dayText(nudge.ev) }),
    reopened: nudge.reopened,
    excluded: nudge.excluded,
    ack,
    actions: actionsOf(nudge),
    text: `${titleText} ${codes.join(' ')} ${ruleLabel}`,
  };
}

function riskOf(board: ActionCenterBoardReply, names: Names): RiskRow[] {
  return board.risk.map((row) => {
    const code = names.codeOf(row.machine);
    return {
      machine: code === null ? null : names.machine(code),
      model: row.model,
      score: { shown: String(row.score), value: row.score },
      why: row.why,
      text: `${code ?? ''} ${row.model} ${row.why}`,
    };
  });
}

/** A card's share of the open nudges ("15% of 33"); none when nothing is open, so there is no division by zero. */
function shareOf(count: number, open: number, t: Translate): string | undefined {
  if (open === 0) return undefined;
  return fill(t('insight.yardstick.share'), { pct: Math.round((count / open) * 100), total: open });
}

function kpisOf(board: ActionCenterBoardReply, t: Translate): KpiData[] {
  const meaning = (sev: NudgeSeverity, count: number): string => {
    if (count === 0) return t('v2a.kpi.none');
    return sev === 'high'
      ? t('analytics.actionCenter.verdict.high')
      : sev === 'med'
        ? t('analytics.actionCenter.verdict.med')
        : t(`v2a.kpi.${sev}`);
  };
  return NUDGE_SEVERITIES.map((sev) => ({
    id: sev,
    label: t(`analytics.actionCenter.tile.${sev}`),
    icon: KPI_ICON[sev],
    value: String(board.bySeverity[sev]),
    delta: { text: '', up: false, good: sev === 'info' },
    period: '',
    meaning: meaning(sev, board.bySeverity[sev]),
    more: t('v2a.kpi.more'),
    yardstick: shareOf(board.bySeverity[sev], board.counts.open, t),
  }));
}

/** The open nudges counted by kind, over the whole board (not the tab, priority or search): one item per kind. */
function openByKind(board: ActionCenterBoardReply, t: Translate): Item[] {
  const kinds = new Map<string, number>();
  for (const nudge of board.nudges)
    if (nudge.status === 'open') kinds.set(nudge.rule, (kinds.get(nudge.rule) ?? 0) + 1);
  return [...kinds].map(([rule, count]) => ({
    name: t(`analytics.actionCenter.rule.${rule}`),
    value: count,
    shown: String(count),
  }));
}

/** One computed line per table (ADR 0035, ticket 654): the nudges by kind, and the risk scores with the machine's code. */
function takeawaysOf(board: ActionCenterBoardReply, risk: RiskRow[], t: Translate): Takeaways {
  const scores: Item[] = risk.map((row) => ({
    name: row.machine?.label ?? '',
    value: row.score.value,
    shown: row.score.shown,
  }));
  return {
    nudges: takeawayFor(openByKind(board, t), { worse: 'high', additive: true }, t),
    risk: takeawayFor(scores, { worse: 'high' }, t),
  };
}

/** The answer first: what needs a person now, and which machine tops the engine's own ranking. */
function verdictOf(board: ActionCenterBoardReply, names: Names, t: Translate): VerdictData {
  const { high, med } = board.bySeverity;
  const open = board.counts.open;
  const sentence =
    open === 0
      ? t('analytics.actionCenter.emptyOpen')
      : high + med === 0
        ? t('v2a.verdict.calm', { n: open })
        : t('analytics.actionCenter.banner', { high, medium: med });
  const top = riskOf(board, names)[0];
  const why: Point[] = [];
  if (top?.machine)
    why.push([
      { text: top.machine.label, entity: top.machine },
      { text: t('v2a.why.top', { score: top.score.shown, why: top.why }) },
    ]);
  why.push([{ text: t('v2a.why.scope') }]);
  return {
    context: t('analytics.actionCenter.intro', { date: dayText(board.asOf) }),
    headline: [{ text: sentence, tone: high > 0 ? 'loss' : med > 0 ? 'risk' : 'strong' }],
    why,
  };
}

function tableWords(title: string, search: string, empty: string, t: Translate) {
  return { title, search, showing: t('v2m.showing'), noResults: empty, open: t('v2m.open') };
}

const formWords = (t: Translate): ActionCenterWords['form'] => ({
  title: t('analytics.actionCenter.form'),
  ownerLabel: t('analytics.actionCenter.ownerLabel'),
  ownerNone: t('analytics.actionCenter.ownerNone'),
  dueLabel: t('analytics.actionCenter.dueLabel'),
  noteLabel: t('analytics.actionCenter.noteLabel'),
  save: t('analytics.actionCenter.save'),
  cancel: t('analytics.actionCenter.cancel'),
});

function wordsOf(t: Translate, snoozeDays: number): ActionCenterWords {
  const sev = (s: NudgeSeverity) => t(`analytics.actionCenter.tile.${s}`);
  const search = t('analytics.actionCenter.search');
  return {
    why: t('v2m.why'),
    tabsLabel: t('analytics.actionCenter.tabs'),
    priorityLabel: t('analytics.actionCenter.priorityLabel'),
    priorityAll: t('analytics.actionCenter.priority'),
    typeLabel: t('analytics.actionCenter.typeLabel'),
    typeAll: t('analytics.actionCenter.type'),
    priorities: { high: sev('high'), med: sev('med'), low: sev('low'), info: sev('info') },
    table: tableWords(t('v2a.table.title'), search, t('analytics.actionCenter.empty'), t),
    emptyOpen: t('analytics.actionCenter.emptyOpen'),
    emptyOther: t('analytics.actionCenter.empty'),
    columns: {
      priority: t('v2a.col.priority'),
      nudge: t('v2a.col.nudge'),
      type: t('analytics.actionCenter.typeLabel'),
      entries: t('v2a.col.entries'),
      latest: t('v2a.col.latest'),
      status: t('v2a.col.status'),
    },
    risk: {
      table: tableWords(
        t('analytics.actionCenter.risk.title'),
        search,
        t('analytics.actionCenter.table.empty'),
        t,
      ),
      machine: t('analytics.actionCenter.risk.machine'),
      score: t('analytics.actionCenter.risk.score'),
      why: t('analytics.actionCenter.risk.why'),
    },
    detail: {
      about: t('v2a.detail.about'),
      latest: t('v2a.col.latest'),
      stored: t('v2a.detail.stored'),
      actions: t('v2a.detail.actions'),
      machines: t('v2a.detail.machines'),
    },
    owner: t('analytics.actionCenter.ownerLabel'),
    ownerNone: t('v2a.owner.none'),
    reopened: t('analytics.actionCenter.reopened'),
    excluded: t('analytics.actionCenter.excluded'),
    actions: {
      acknowledge: t('analytics.actionCenter.acknowledge'),
      snooze: t('analytics.actionCenter.snooze', { days: snoozeDays }),
      resolve: t('analytics.actionCenter.resolve'),
      reopen: t('analytics.actionCenter.reopen'),
    },
    form: formWords(t),
    saveFailed: t('analytics.actionCenter.saveFailed'),
  };
}

/** The Action Center from the engine's board: every nudge, count and risk row it sent, in the reader's words. */
export function actionCenterModel(facts: BoardFacts, t: Translate): ActionCenterModel {
  const { board } = facts;
  const names = namesOf(facts, t);
  const risk = riskOf(board, names);
  return {
    verdict: verdictOf(board, names, t),
    kpis: kpisOf(board, t),
    tabs: NUDGE_STATUSES.map((key) => ({
      key,
      label: t(`analytics.actionCenter.tab.${key}`),
      count: board.counts[key],
    })),
    types: NUDGE_RULES.map((key) => ({ key, label: t(`analytics.actionCenter.rule.${key}`) })),
    nudges: board.nudges.map((nudge) => rowOf(nudge, facts, names, t)),
    risk,
    takeaways: takeawaysOf(board, risk, t),
    people: facts.people.filter((p) => p.active).map((p) => p.name),
    snoozeDays: board.snoozeDays,
    source: sourceLine(t('v2m.source'), board.asOf),
    words: wordsOf(t, board.snoozeDays),
  };
}
