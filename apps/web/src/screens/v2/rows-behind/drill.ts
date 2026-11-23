import type { FiguresReply } from '@uptimo/shared/analytics';
import { fill } from '../../../i18n/fill.js';
import type { Drill } from '../../../ui/v2/drill.js';
import type { Translate } from '../figures/read.js';
import { figureName } from './model.js';

/**
 * The control that opens the rows behind a figure, in the reader's words: only when the engine named rows for it. A
 * figure with no rows (not computed, or counting nothing) has no control, so nothing opens an empty panel.
 */
export function drillFor(
  reply: Pick<FiguresReply, 'figures'>,
  key: string,
  t: Translate,
): Drill | undefined {
  const figure = reply.figures.find((candidate) => candidate.key === key);
  if (figure?.status !== 'ready' || figure.drill.ids.length === 0) return undefined;
  return { figure: key, label: fill(t('v2m.rows.open'), { figure: figureName(key, t) }) };
}

/**
 * v1's "See the rows" on a page whose figure is the whole page (A1, A2, A3: every breakdown the page counts): a control
 * of the page, since no card on it counts exactly those rows. It opens every ticket the engine named for the figure.
 */
export function seeRowsFor(
  reply: Pick<FiguresReply, 'figures'>,
  key: string,
  t: Translate,
): Drill | undefined {
  const drill = drillFor(reply, key, t);
  return drill ? { ...drill, label: t('analytics.drill.open') } : undefined;
}

/**
 * The page-level "See the machines" control: opens every row the figure counted, for a page whose cards count
 * something narrower (one register, one age band). It is a control of the page, not of a count.
 */
export function seeMachinesFor(
  reply: Pick<FiguresReply, 'figures'>,
  key: string,
  t: Translate,
): Drill | undefined {
  const drill = drillFor(reply, key, t);
  return drill ? { ...drill, label: t('analytics.registers.seeMachines') } : undefined;
}
