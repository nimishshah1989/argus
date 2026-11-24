import type { TFunction } from 'i18next';
import { focusPeriodSchema, type FocusNote } from '@uptimo/shared/team-focus-notes';
import { focusActions } from '../../analytics/team-focus-actions.js';
import { NotComputed } from '../figures/live-error.js';
import { figureOf, type FiguresPart } from '../printed-page/printed.js';
import { teamFocusModel, withNotes } from './adapter.js';
import type { TeamFocusModel } from './model.js';

export const KEY = 'team-focus';

/** The month the engine's plan is for (`YYYY-MM`, the figure's `period`), or null when the figure has none ready. */
export function focusPeriod(reply: FiguresPart): string | null {
  const figure = figureOf(reply, KEY);
  if (figure?.status !== 'ready') return null;
  const value: unknown = figure.value;
  const period =
    typeof value === 'object' && value !== null ? (value as { period?: unknown }).period : null;
  const parsed = focusPeriodSchema.safeParse(period);
  return parsed.success ? parsed.data : null;
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
  const figure = figureOf(reply, KEY);
  if (figure === undefined || figure.status !== 'ready') throw new NotComputed();
  const actions = focusActions(figure.value);
  if (actions.length === 0) throw new NotComputed();
  return teamFocusModel(withNotes(actions, notes), reply.asOf, t);
}
