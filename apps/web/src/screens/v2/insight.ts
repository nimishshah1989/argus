import { fill } from '../../i18n/fill.js';
import type { TakeawayData, TakeawayTone } from '../../ui/v2/takeaway.js';

export type Item = { name: string; value: number; shown: string };
type Say = (key: string) => string;

/** The tone's word, from the catalogue (`insight.tag.*`), so colour never stands alone. */
export const tagOf = (tone: TakeawayTone, t: Say) => t(`insight.tag.${tone}`);

/**
 * The generic "X is N× the others" takeaway: the item furthest from its peers (the biggest when `worse` is 'high', the
 * smallest when 'low'), set against the average of the rest. N is printed to one place. With fewer than two items, or an
 * average of 0, or the outlier under `min`× the others, nothing stands out and the line says so in a neutral tone.
 */
export function outlierTakeaway(
  items: Item[],
  t: Say,
  { worse = 'high', min = 1.5 }: { worse?: 'high' | 'low'; min?: number } = {},
): TakeawayData {
  const none: TakeawayData = { text: t('insight.none'), tone: 'neutral', tag: tagOf('neutral', t) };
  if (items.length < 2) return none;
  const top = items.reduce((a, b) =>
    (worse === 'high' ? b.value > a.value : b.value < a.value) ? b : a,
  );
  const rest = items.filter((i) => i !== top);
  const avg = rest.reduce((sum, i) => sum + i.value, 0) / rest.length;
  const n = worse === 'high' ? top.value / avg : avg / top.value;
  if (!Number.isFinite(n) || n < min) return none;
  return {
    text: fill(t('insight.outlier'), { name: top.name, n: n.toFixed(1), value: top.shown }),
    tone: 'loss',
    tag: tagOf('loss', t),
    outlier: top.name,
  };
}
