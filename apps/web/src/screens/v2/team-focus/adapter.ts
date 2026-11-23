import type { TFunction } from 'i18next';
import type { FocusNote, FocusStatus } from '@uptimo/shared/team-focus-notes';
import type { DecisionKind } from '../../../ui/v2/domain/decision-row.js';
import type { FocusAction, FocusLane } from '../../analytics/team-focus-actions.js';
import type { ActionStatus, TeamFocusModel } from './model.js';

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
  void actions;
  void notes;
  throw new Error('not implemented');
}

/** The v2 model for the month's actions (notes already laid over), as of the figures' `asOf` (`YYYY-MM-DD`). */
export function teamFocusModel(
  actions: readonly FocusAction[],
  asOf: string,
  t: TFunction,
): TeamFocusModel {
  void actions;
  void asOf;
  void t;
  throw new Error('not implemented');
}
