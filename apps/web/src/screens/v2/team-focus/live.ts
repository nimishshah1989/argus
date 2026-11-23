import type { TFunction } from 'i18next';
import type { FocusNote } from '@uptimo/shared/team-focus-notes';
import type { FiguresPart } from '../printed-page/printed.js';
import type { TeamFocusModel } from './model.js';

export const KEY = 'team-focus';

/** The month the engine's plan is for (`YYYY-MM`, the figure's `period`), or null when the figure has none ready. */
export function focusPeriod(reply: FiguresPart): string | null {
  void reply;
  throw new Error('not implemented');
}

/**
 * Team Focus from the figures reply and the month's saved notes (`GET /analytics/team-focus/notes`). A figure that is
 * missing, not ready, or has no action is "not computed yet" (`NotComputed`), never an empty plan.
 */
export function liveTeamFocus(
  reply: FiguresPart,
  notes: Readonly<Record<string, FocusNote>>,
  t: TFunction,
): TeamFocusModel {
  void reply;
  void notes;
  void t;
  throw new Error('not implemented');
}
