import type { TFunction } from 'i18next';
import { fill } from '../../../i18n/fill.js';
import type { FocusNote, FocusStatus } from '@uptimo/shared/team-focus-notes';
import type { DecisionData, DecisionKind } from '../../../ui/v2/domain/decision-row.js';
import type { EntityChipProps } from '../../../ui/v2/entity-chip.js';
import type { KpiData } from '../../../ui/v2/kpi-card.js';
import type { VerdictData } from '../../../ui/v2/verdict.js';
import {
  FOCUS_LANE_HINTS,
  FOCUS_LANE_LABELS,
  focusStatusKey,
  stakeText,
  type FocusAction,
  type FocusLane,
} from '../../analytics/team-focus-actions.js';
import { takeawayFor, type Item } from '../insight.js';
import { shortDate } from '../printed-page/printed.js';
import type { ActionRow, ActionStatus, PersonLoad, TeamFocusModel } from './model.js';
import { teamFocusWords } from './words.js';

/**
 * Team Focus live (TF-2, ADR 0020): the engine's month of actions with the team's saved notes laid over them, as the
 * v2 model. Every title and stake is the engine's; every status, owner and note is the team's; nothing is invented
 * (no load rule, no suggested owner, no rebalance, no money, no "vs last month").
 */

/** The platform's stored status words (ADR 0018) as the screen's: one to one. */
export const STATUS_OF: Record<FocusStatus, ActionStatus> = {
  open: 'todo',
  prog: 'doing',
  done: 'done',
  skip: 'skip',
};

/** The screen's status words back to the stored ones, for TF-3's writes. */
export const STORED_OF: Record<ActionStatus, FocusStatus> = {
  todo: 'open',
  doing: 'prog',
  done: 'done',
  skip: 'skip',
};

/** Each lane's decision kind, as the gallery draws them. */
export const KIND_OF: Record<FocusLane, DecisionKind> = {
  A: 'inspect',
  B: 'fix',
  C: 'decide',
  F: 'plan',
  D: 'plan',
  E: 'plan',
};

/** The prefix of an owner chip's id: an owner is saved free text, never a person id (ADR 0020 §4). */
export const OWNER_PREFIX = 'owner:';

/**
 * The engine's actions with each one's saved note laid over its status, owner and note. A note for an action the
 * engine no longer prints is ignored; the engine's order is kept.
 */
export function withNotes(
  actions: readonly FocusAction[],
  notes: Readonly<Record<string, FocusNote>>,
): FocusAction[] {
  return actions.map((action) => {
    const saved = notes[action.key];
    return saved === undefined
      ? { ...action }
      : { ...action, status: saved.status, owner: saved.owner, note: saved.note };
  });
}

const isOpen = (action: FocusAction) => action.status !== 'done' && action.status !== 'skip';
/** Hours added up; rounded so a sum of two-place stakes never prints float dust. */
const sumOf = (actions: readonly FocusAction[]) =>
  Math.round(actions.reduce((total, action) => total + action.stake, 0) * 100) / 100;
const hoursOf = (t: TFunction, stake: number) => t('v2tf.hours', { hours: stakeText(stake) });
const count = (n: number) => n.toLocaleString('en-IN');
const pct = (part: number, whole: number) => Math.round((part / whole) * 100);

const ownerChip = (owner: string): EntityChipProps => ({
  kind: 'person',
  id: OWNER_PREFIX + owner,
  label: owner,
});

function rowOf(action: FocusAction, t: TFunction): ActionRow {
  return {
    id: action.key,
    kind: KIND_OF[action.lane],
    kindLabel: t(FOCUS_LANE_LABELS[action.lane]),
    title: action.title,
    chips:
      action.machine === null
        ? []
        : [{ kind: 'machine', id: action.machine, label: action.machine }],
    owner: action.owner === '' ? null : ownerChip(action.owner),
    status: STATUS_OF[action.status as FocusStatus] ?? 'todo',
    statusLabel: t(focusStatusKey(action.status)),
    hours: { shown: hoursOf(t, action.stake), value: action.stake },
    note: action.note,
  };
}

/** The open actions nobody owns, biggest first (ties in the engine's order), each with its lane's hint. */
function startOf(actions: readonly FocusAction[], rows: readonly ActionRow[], t: TFunction) {
  return actions
    .map((action, i) => ({ action, row: rows[i]! }))
    .filter(({ action }) => isOpen(action) && action.owner === '')
    .sort((a, b) => b.action.stake - a.action.stake)
    .map(({ action, row }): DecisionData => {
      const hint = [[{ text: t(FOCUS_LANE_HINTS[action.lane]) }]];
      return {
        id: row.id,
        kind: row.kind,
        kindLabel: row.kindLabel,
        codes: row.chips,
        title: row.title,
        keys: [{ text: t('v2tf.noOwner'), tone: 'risk' }],
        why: hint,
        detail: hint,
        hours: row.hours.shown,
        money: '',
        days: [],
        stripLabel: '',
        action: t('v2tf.take'),
        doneText: t('v2tf.taken'),
        owner: [{ text: t('v2tf.ownerNone') }],
        decided: false,
      };
    });
}

/** One person for each owner the notes name, the one with the most open actions first. */
function peopleOf(actions: readonly FocusAction[], t: TFunction): PersonLoad[] {
  const names = [...new Set(actions.map((action) => action.owner).filter((name) => name !== ''))];
  return names
    .map((name) => {
      const theirs = actions.filter((action) => action.owner === name);
      const open = theirs.filter(isOpen);
      const stake = sumOf(open);
      return {
        chip: ownerChip(name),
        role: '',
        open: open.length,
        hours: { shown: hoursOf(t, stake), value: stake },
        done: theirs.length - open.length,
        load: null,
        loadLabel: '',
      };
    })
    .sort((a, b) => b.open - a.open || a.chip.label.localeCompare(b.chip.label));
}

const NO_DELTA = { text: '', up: false, good: false };

function kpisOf(actions: readonly FocusAction[], start: readonly DecisionData[], t: TFunction) {
  const open = actions.filter(isOpen);
  const closed = actions.length - open.length;
  const doing = open.filter((action) => action.status === 'prog').length;
  const skip = actions.filter((action) => action.status === 'skip').length;
  const kpi = (id: KpiData['id'], icon: KpiData['icon'], value: string, more: string): KpiData => ({
    id,
    label: t(`v2tf.kpi.${id}.label`),
    icon,
    value,
    delta: NO_DELTA,
    period: '',
    meaning: t(`v2tf.kpi.${id}.meaning`),
    more,
  });
  return [
    kpi(
      'open',
      'list',
      count(open.length),
      t('v2tf.kpi.open.more', { doing, todo: open.length - doing }),
    ),
    kpi('stake', 'clock', hoursOf(t, sumOf(open)), t('v2tf.kpi.stake.more')),
    kpi(
      'unowned',
      'person',
      count(start.length),
      start[0] === undefined
        ? t('v2tf.kpi.unowned.none')
        : t('v2tf.kpi.unowned.more', { title: start[0].title }),
    ),
    kpi(
      'progress',
      'check',
      `${pct(closed, actions.length)}%`,
      t('v2tf.kpi.progress.more', { done: closed - skip, skip }),
    ),
  ];
}

function verdictOf(
  actions: readonly FocusAction[],
  unowned: number,
  asOf: string,
  t: TFunction,
): VerdictData {
  const open = actions.filter(isOpen);
  const closed = actions.length - open.length;
  const biggest = open.reduce<FocusAction | undefined>(
    (best, action) => (best === undefined || action.stake > best.stake ? action : best),
    undefined,
  );
  const unownedStake = sumOf(open.filter((action) => action.owner === ''));
  const why = [
    ...(unowned > 0
      ? [
          t('v2tf.why.unowned', {
            unowned,
            open: open.length,
            hours: hoursOf(t, unownedStake),
          }),
        ]
      : []),
    t('v2tf.why.closed', { closed, total: actions.length, pct: pct(closed, actions.length) }),
    ...(biggest === undefined
      ? []
      : [t('v2tf.why.biggest', { title: biggest.title, hours: hoursOf(t, biggest.stake) })]),
  ];
  const headline =
    open.length === 0
      ? t('v2tf.headline.allClosed')
      : t('v2tf.headline', { open: open.length, hours: hoursOf(t, sumOf(open)), unowned });
  return {
    context: t('v2tf.context', { date: shortDate(asOf) }),
    headline: [{ text: headline }],
    why: why.map((text) => [{ text }]),
  };
}

const roundHours = (n: number) => Math.round(n * 100) / 100;

/**
 * The three takeaways (start, people, actions) and each KPI's yardstick, computed from the model so the live page and
 * the gallery say the same (ADR 0035). Figures never change; `delta.text` stays empty.
 */
export function withInsight(model: TeamFocusModel, t: TFunction): TeamFocusModel {
  const say = (key: string) => t(key);
  const open = model.actions.filter((row) => row.status === 'todo' || row.status === 'doing');
  const unowned = open.filter((row) => row.owner === null);
  const lanes = new Map<string, number>();
  for (const row of open)
    lanes.set(row.kindLabel, (lanes.get(row.kindLabel) ?? 0) + row.hours.value);
  const share = (part: number, total: number) =>
    fill(say('insight.yardstick.share'), {
      pct: total === 0 ? 0 : pct(part, total),
      total: count(total),
    });
  const openHours = open.reduce((n, row) => n + row.hours.value, 0);
  const yardsticks: Record<string, string> = {
    open: share(open.length, model.actions.length),
    stake: fill(say('insight.yardstick.average'), {
      value: hoursOf(t, open.length === 0 ? 0 : roundHours(openHours / open.length)),
    }),
    unowned: share(unowned.length, open.length),
    progress: fill(say('insight.yardstick.target'), { value: '100%' }),
  };
  const meaning = { worse: 'high', additive: true } as const;
  const lineOf = (items: Item[]) => takeawayFor(items, meaning, say);
  return {
    ...model,
    takeaways: {
      start: lineOf(
        unowned.map((row) => ({ name: row.title, value: row.hours.value, shown: row.hours.shown })),
      ),
      people: lineOf(
        model.people.map((p) => ({
          name: p.chip.label,
          value: p.hours.value,
          shown: p.hours.shown,
        })),
      ),
      actions: lineOf(
        [...lanes].map(([name, value]) => ({ name, value, shown: hoursOf(t, roundHours(value)) })),
      ),
    },
    kpis: model.kpis.map((k) => ({ ...k, yardstick: yardsticks[k.id] })),
  };
}

/** The v2 model for the month's actions (notes already laid over), as of the figures' `asOf` (`YYYY-MM-DD`). */
export function teamFocusModel(
  actions: readonly FocusAction[],
  asOf: string,
  t: TFunction,
): TeamFocusModel {
  const rows = actions.map((action) => rowOf(action, t));
  const start = startOf(actions, rows, t);
  const people = peopleOf(actions, t);
  return withInsight(
    {
      verdict: verdictOf(actions, start.length, asOf, t),
      kpis: kpisOf(actions, start, t),
      start,
      people,
      rebalance: null,
      actions: rows,
      source: t('v2tf.source', { date: shortDate(asOf) }),
      words: teamFocusWords(t, rows.length, people.length),
    },
    t,
  );
}
