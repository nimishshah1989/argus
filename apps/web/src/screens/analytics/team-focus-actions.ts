import type { MessageKey } from '@uptimo/shared/i18n';
import { figurePlaces, figureMeasure, splitFigure } from '../../ui/meaning/index.js';

/**
 * Team Focus' action list (43e): the engine's own `extra` rows, grouped by the platform's six lanes in the
 * order the key prints them (A, B, C, F, D, E). The engine computes every title and stake; this module only
 * reads them, never invents one. Status, owner and note are the platform's defaults until the later server
 * packet stores them, so the screen prints them honestly.
 */

type ObjectValue = Record<string, unknown>;

export const FOCUS_LANES = ['A', 'B', 'C', 'F', 'D', 'E'] as const;

export type FocusLane = (typeof FOCUS_LANES)[number];

export interface FocusAction {
  key: string;
  lane: FocusLane;
  /** The machine the action names; null for the spares and record lanes, which name none. */
  machine: string | null;
  title: string;
  /** Hours a month at stake, exactly as the engine rounded them. */
  stake: number;
  status: string;
  owner: string;
  note: string;
}

export interface FocusLaneGroup {
  lane: FocusLane;
  actions: FocusAction[];
}

export const FOCUS_LANE_LABELS: Record<FocusLane, MessageKey> = {
  A: 'analytics.teamFocus.lane.A',
  B: 'analytics.teamFocus.lane.B',
  C: 'analytics.teamFocus.lane.C',
  F: 'analytics.teamFocus.lane.F',
  D: 'analytics.teamFocus.lane.D',
  E: 'analytics.teamFocus.lane.E',
};

export const FOCUS_LANE_HINTS: Record<FocusLane, MessageKey> = {
  A: 'analytics.teamFocus.hint.A',
  B: 'analytics.teamFocus.hint.B',
  C: 'analytics.teamFocus.hint.C',
  F: 'analytics.teamFocus.hint.F',
  D: 'analytics.teamFocus.hint.D',
  E: 'analytics.teamFocus.hint.E',
};

const STATUS_KEYS: Record<string, MessageKey> = {
  open: 'analytics.teamFocus.status.open',
  prog: 'analytics.teamFocus.status.prog',
  done: 'analytics.teamFocus.status.done',
  skip: 'analytics.teamFocus.status.skip',
};

/** The catalogue word for one saved status; an unknown status reads as the platform's default, not a blank. */
export function focusStatusKey(status: string): MessageKey {
  return STATUS_KEYS[status] ?? STATUS_KEYS.open!;
}

function laneOf(value: unknown): FocusLane | null {
  return FOCUS_LANES.find((lane) => lane === value) ?? null;
}

function isObject(value: unknown): value is ObjectValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** One action the key printed: its computed text and stake, and its untouched status, owner and note. */
function actionOf(raw: unknown): FocusAction | null {
  if (!isObject(raw)) return null;
  const lane = laneOf(raw.lane);
  const stake = Number(raw.stake);
  if (
    lane === null ||
    typeof raw.key !== 'string' ||
    typeof raw.title !== 'string' ||
    !Number.isFinite(stake)
  )
    return null;
  return {
    key: raw.key,
    lane,
    machine: typeof raw.machine === 'string' ? raw.machine : null,
    title: raw.title,
    stake,
    status: typeof raw.status === 'string' ? raw.status : 'open',
    owner: typeof raw.owner === 'string' ? raw.owner : '',
    note: typeof raw.note === 'string' ? raw.note : '',
  };
}

/** The engine's actions in its own order; a row the mapper cannot read is dropped, never zeroed. */
export function focusActions(value: unknown): FocusAction[] {
  if (!isObject(value) || !Array.isArray(value.extra)) return [];
  return value.extra.flatMap((raw) => {
    const action = actionOf(raw);
    return action === null ? [] : [action];
  });
}

/** The hours at stake as the engine gave them (at most 2 places, one at least: "6.09", "10.0"), Indian grouping. */
export function stakeText(stake: number): string {
  const measure = figureMeasure('dashboard.total-downtime-hours');
  const places = figurePlaces(measure, stake);
  return splitFigure(measure, stake, places, places).text;
}

/**
 * The number inside a figure the engine printed as text ("31", "0%", "1,343 hrs"), or null when there is none ("—").
 * The tile prints the engine's own text; this number is only what its count-up eases to.
 */
export function printedNumber(text: string): number | null {
  const match = /-?\d[\d,]*(?:\.\d+)?/.exec(text);
  if (match === null) return null;
  const parsed = Number(match[0].replaceAll(',', ''));
  return Number.isFinite(parsed) ? parsed : null;
}

/** The actions grouped by lane, in the platform's lane order; a lane with no action prints no group. */
export function focusLaneGroups(actions: readonly FocusAction[]): FocusLaneGroup[] {
  return FOCUS_LANES.flatMap((lane) => {
    const found = actions.filter((action) => action.lane === lane);
    return found.length === 0 ? [] : [{ lane, actions: found }];
  });
}
