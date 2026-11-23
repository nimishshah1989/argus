import type { TFunction } from 'i18next';
import type { FiguresPart } from '../printed-page/printed.js';
import type { DataChecklistModel } from './model.js';

/** The engine figure the screen is built from. */
export const KEY = 'data-checklist';

/**
 * The Data Checklist from the figures reply: `checklistModel(itemsOf(figure.value), reply.asOf, t)`. A figure that is
 * missing or not `ready` throws `NotComputed` ("Not computed yet"), never an empty plant (ADR 0017).
 */
export function liveChecklist(reply: FiguresPart, t: TFunction): DataChecklistModel {
  void reply;
  void t;
  throw new Error('not built');
}
