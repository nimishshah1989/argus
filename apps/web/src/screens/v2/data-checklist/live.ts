import type { TFunction } from 'i18next';
import type { Drill } from '../../../ui/v2/drill.js';
import { NotComputed } from '../figures/live-error.js';
import { figureOf, type FiguresPart } from '../printed-page/printed.js';
import { drillFor } from '../rows-behind/drill.js';
import { checklistModel, itemsOf } from './adapter.js';
import type { DataChecklistModel } from './model.js';

/** The engine figure the screen is built from. */
export const KEY = 'data-checklist';

/**
 * The Data Checklist from the figures reply: `checklistModel(itemsOf(figure.value), reply.asOf, t)`. A figure that is
 * missing or not `ready` throws `NotComputed` ("Not computed yet"), never an empty plant (ADR 0017).
 */
export function liveChecklist(reply: FiguresPart, t: TFunction): DataChecklistModel {
  const figure = figureOf(reply, KEY);
  if (figure === undefined || figure.status !== 'ready') throw new NotComputed();
  const model = checklistModel(itemsOf(figure.value), reply.asOf, t);
  const drill = drillFor(reply, KEY, (key, values) => t(key, { ...values }) as string);
  return drill ? { ...model, drill } : model;
}

/** Where a check's fix button ("Open the entries", "Open the machine records") takes the reader (ADR 0017 (e), 0019). */
export type FixTarget = { drill: Drill } | { to: string };

/** The Breakdown log and the machine register, at the addresses the app already serves them on. */
export const LOG_PATH = '/analytics/breakdowns?screen=breakdown-log';
export const REGISTER_PATH = '/analytics/machines?screen=registers';

/**
 * A check's fix target, by its engine group (`checkId`): a machine-record check (`mc_*`) → the register; `log_gap` → the
 * Breakdown log (no ticket is behind a missing day); a breakdown or Why-Why check (`bd_*`, `ww`) → the page's drill to
 * the tickets behind the gaps, or the Breakdown log when the engine named none.
 */
export function fixTarget(checkId: string, drill: Drill | undefined): FixTarget {
  if (checkId.startsWith('mc_')) return { to: REGISTER_PATH };
  if (checkId === 'log_gap') return { to: LOG_PATH };
  return drill ? { drill } : { to: LOG_PATH };
}
