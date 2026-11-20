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
