import {
  NUDGE_RULES,
  NUDGE_SEVERITIES,
  NUDGE_STATUSES,
  type ActionCenterBoardReply,
  type BoardNudgeReply,
  type NudgeSeverity,
} from '@uptimo/shared';
import type { MessageKey } from '@uptimo/shared/i18n';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { IconName } from '../../../ui/v2/icons.js';
import { plantDayOf } from '../../analytics/action-center.js';
import { dayText, machineChip, sourceLine, type Translate } from '../figures/read.js';
import { commonWords } from '../figures/words.js';
import type { ActionCenterModel, NudgeAction, NudgeCard, RiskRow } from './model.js';

/** What the plant knows beside the board: the machines the nudges name (codes, not ids) and the people who may own one. */
export type ActionFacts = {
  machines: readonly { id: string; code: string; category: string | null }[];
  people: readonly { id: string; name: string; active: boolean }[];
  timeZone: string;
};

/** The words the catalogue already holds for each priority, nudge type and status (one phrase, one key). */
const SEVERITY: Record<NudgeSeverity, MessageKey> = {
  high: 'analytics.actionCenter.tile.high',
  med: 'analytics.actionCenter.tile.med',
  low: 'analytics.actionCenter.tile.low',
  info: 'analytics.actionCenter.tile.info',
};
const RULE = (rule: string) => `analytics.actionCenter.rule.${rule}`;
const TAB = (status: string) => `analytics.actionCenter.tab.${status}`;
const ICON: Record<NudgeSeverity, IconName> = {
  high: 'alert',
  med: 'clock',
  low: 'list',
  info: 'check',
};
const NEEDS_WORD: Partial<Record<NudgeSeverity, MessageKey>> = {
  high: 'analytics.actionCenter.verdict.high',
  med: 'analytics.actionCenter.verdict.med',
};
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

/** What one card can do: good news only informs, a stored status only reopens, an open nudge takes the three writes. */
function actionsOf(nudge: BoardNudgeReply): NudgeAction[] {
  if (nudge.sev === 'info') return [];
  return nudge.status === 'open' ? ['ack', 'snooze', 'resolved'] : ['reopen'];
}

/** What was done to a stored nudge, one phrase each: the status, the owner, the due day and the note. */
function savedOf(nudge: BoardNudgeReply, zone: string, t: Translate): string[] {
  const ack = nudge.ack;
  if (nudge.status === 'open' || ack === null) return [];
  const until = ack.until === undefined ? '' : dayText(plantDayOf(ack.until, zone));
  return [
    nudge.status === 'snoozed'
      ? t('analytics.actionCenter.status.snoozed', { date: until })
      : t(`analytics.actionCenter.status.${nudge.status}`),
    ...(ack.owner === '' ? [] : [t('analytics.actionCenter.owner', { owner: ack.owner })]),
    ...(ack.due === '' ? [] : [t('analytics.actionCenter.due', { date: dayText(ack.due) })]),
    ...(ack.note === '' ? [] : [t('analytics.actionCenter.note', { note: ack.note })]),
  ];
}

/** The board names machines by id; the plant reads codes. A code is never a UUID, so no id reaches the screen. */
function namer(facts: ActionFacts) {
  const byId = new Map(facts.machines.map((machine) => [machine.id, machine]));
  return {
    code: (id: string) => byId.get(id)?.code ?? id,
    chip: (id: string) => {
      const machine = byId.get(id);
      return machineChip(machine?.code ?? id, machine?.category ?? undefined);
    },
    text: (printed: string) => printed.replace(UUID, (id) => byId.get(id)?.code ?? id),
  };
}

function cardOf(
  nudge: BoardNudgeReply,
  facts: ActionFacts,
  names: ReturnType<typeof namer>,
  t: Translate,
): NudgeCard {
  return {
    key: nudge.key,
    rule: nudge.rule,
    severity: nudge.sev,
    type: t(RULE(nudge.rule)),
    title: names.text(nudge.title),
    machines: nudge.machines.map(names.chip),
    entries: t('analytics.actionCenter.entries', { count: nudge.entries }),
    evidence:
      nudge.ev === null ? '' : t('analytics.actionCenter.latestEntry', { date: dayText(nudge.ev) }),
    reopened: nudge.reopened,
    excluded: nudge.excluded,
    status: nudge.status,
    saved: savedOf(nudge, facts.timeZone, t),
    actions: actionsOf(nudge),
  };
}

/** A risk row's machine cell is "id model"; the board sends them apart, and the plant reads the code. */
function riskOf(board: ActionCenterBoardReply, names: ReturnType<typeof namer>): RiskRow[] {
  return board.risk.map((row) => ({
    machine: names.chip(row.machine),
    model: row.model,
    score: { shown: String(row.score), value: row.score },
    why: row.why,
  }));
}

function tileOf(board: ActionCenterBoardReply, severity: NudgeSeverity, t: Translate): KpiData {
  const meaning = NEEDS_WORD[severity];
  return {
    id: severity,
    label: t(SEVERITY[severity]),
    icon: ICON[severity],
    value: String(board.bySeverity[severity]),
    delta: { text: '', up: false, good: true, flat: true },
    period: '',
    meaning: meaning !== undefined && board.bySeverity[severity] > 0 ? t(meaning) : '',
    more: '',
  };
}

/** Every word the screen prints beside the board's own, in the reader's language. */
function wordsOf(snoozeDays: number, t: Translate): ActionCenterModel['words'] {
  const common = commonWords(t);
  return {
    why: common.why,
    tabsLabel: t('analytics.actionCenter.tabs'),
    nudgesTitle: t('v2t.ac.nudges'),
    priorityLabel: t('analytics.actionCenter.priorityLabel'),
    allPriorities: t('analytics.actionCenter.priority'),
    typeLabel: t('analytics.actionCenter.typeLabel'),
    allTypes: t('analytics.actionCenter.type'),
    search: t('analytics.actionCenter.search'),
    snooze: t('analytics.actionCenter.snooze', { days: snoozeDays }),
    acknowledge: t('analytics.actionCenter.acknowledge'),
    resolve: t('analytics.actionCenter.resolve'),
    reopen: t('analytics.actionCenter.reopen'),
    reopened: t('analytics.actionCenter.reopened'),
    excluded: t('analytics.actionCenter.excluded'),
    saveFailed: t('analytics.actionCenter.saveFailed'),
    emptyOpen: t('analytics.actionCenter.emptyOpen'),
    empty: t('analytics.actionCenter.empty'),
    form: {
      title: t('analytics.actionCenter.form'),
      owner: t('analytics.actionCenter.ownerLabel'),
      ownerNone: t('analytics.actionCenter.ownerNone'),
      due: t('analytics.actionCenter.dueLabel'),
      note: t('analytics.actionCenter.noteLabel'),
      save: t('analytics.actionCenter.save'),
      cancel: t('analytics.actionCenter.cancel'),
    },
    risk: {
      title: t('analytics.actionCenter.risk.title'),
      search: t('analytics.actionCenter.search'),
      showing: common.showing,
      noResults: t('analytics.actionCenter.table.empty'),
      open: common.open,
      all: common.all,
      columns: {
        machine: t('analytics.actionCenter.risk.machine'),
        score: t('analytics.actionCenter.risk.score'),
        why: t('analytics.actionCenter.risk.why'),
      },
    },
  };
}

/**
 * The Action Center from the board the server answers (`GET /analytics/action-center`): every nudge with its status,
 * the counts the server worked out, and the risk rows. Nothing is derived beyond words: there is no value per decision
 * and no money on this screen, because the engine holds none.
 */
export function actionCenterModel(
  board: ActionCenterBoardReply,
  facts: ActionFacts,
  t: Translate,
): ActionCenterModel {
  const names = namer(facts);
  const common = commonWords(t);
  const { high, med } = board.bySeverity;
  return {
    verdict: {
      headline: [
        board.counts.open === 0
          ? { text: t('v2t.ac.clear') }
          : {
              text: t('analytics.actionCenter.banner', { high, medium: med }),
              tone: high > 0 ? 'loss' : 'risk',
            },
      ],
      why: [[{ text: t('v2t.ac.why1') }], [{ text: t('v2t.ac.why2') }]],
      context: t('analytics.actionCenter.intro', { date: dayText(board.asOf) }),
    },
    tiles: NUDGE_SEVERITIES.map((severity) => tileOf(board, severity, t)),
    tabs: NUDGE_STATUSES.map((status) => ({
      status,
      label: t(TAB(status)),
      count: board.counts[status],
    })),
    priorities: NUDGE_SEVERITIES.map((key) => ({ key, label: t(SEVERITY[key]) })),
    types: NUDGE_RULES.map((key) => ({ key, label: t(RULE(key)) })),
    risk: riskOf(board, names),
    nudges: board.nudges.map((nudge) => cardOf(nudge, facts, names, t)),
    people: facts.people
      .filter((person) => person.active)
      .map((person) => ({ id: person.id, name: person.name })),
    severityLabels: Object.fromEntries(
      NUDGE_SEVERITIES.map((key) => [key, t(SEVERITY[key])]),
    ) as ActionCenterModel['severityLabels'],
    source: sourceLine(common.source, board.asOf),
    words: wordsOf(board.snoozeDays, t),
  };
}
