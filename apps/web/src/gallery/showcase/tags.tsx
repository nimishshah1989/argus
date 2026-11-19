import type { TFunction } from 'i18next';
import type { TagSpec } from '../../ui/elements/tags.js';
import { FULL, change, monthLong, rangePos, type Metric } from './data.js';

export { Tag, TagGlyph, Tags, tagHtml, type TagSpec } from '../../ui/elements/tags.js';

type TagTone = TagSpec['tone'];
const spec = (tone: TagTone, word: string, more?: string, icon?: 'clock'): TagSpec => ({
  tone,
  word,
  more,
  icon,
});

/** Where the month sits in the plant's own usual range. Outside it, green or red says whether that is good for THIS figure. */
export function rangeTag(t: TFunction, metric: Metric, i: number): TagSpec | null {
  // A running month's sum is not a full month's: set against the usual range it would falsely read "below".
  if (metric.additive && i >= FULL) return null;
  const pos = rangePos(metric, metric.values[i] ?? null);
  if (!pos) return null;
  const more = t('tag.of', { month: monthLong(i) });
  if (pos === 'within' || metric.better === 'none') return spec('neutral', t(`tag.${pos}`), more);
  return spec(
    (pos === 'above') === (metric.better === 'up') ? 'good' : 'bad',
    t(`tag.${pos}`),
    more,
  );
}

/** Better or worse than the month before, by the direction that is good for this figure (not by the arrow). */
export function trendTag(t: TFunction, metric: Metric, i: number): TagSpec | null {
  const ch = change(metric, i);
  if (!ch) return null;
  const month = monthLong(ch.from).slice(0, 3);
  if (metric.better === 'none') return spec('neutral', t('tag.planned'));
  if (ch.tone === 'flat') return spec('neutral', t('tag.steady', { month }));
  return ch.tone === 'good'
    ? spec('good', t('tag.improving', { month }))
    : spec('bad', t('tag.worsening', { month }));
}

/** A month still running: its sums are not a full month's. */
export const partialTag = (t: TFunction): TagSpec =>
  spec('watch', t('tag.partial'), undefined, 'clock');

export const causeTag = (t: TFunction): TagSpec => spec('watch', t('tag.topCause'));

/** A machine that lost 10 hours or more in four or more months is a repeat offender; one month holding 60 % of its hours is a spike. */
export function riskTag(t: TFunction, hours: number[]): TagSpec | null {
  const total = hours.reduce((s, h) => s + h, 0);
  if (hours.filter((h) => h >= 10).length >= 4) return spec('bad', t('tag.repeat'));
  if (total > 0 && Math.max(...hours) >= total * 0.6) return spec('watch', t('tag.spike'));
  return null;
}

/** The tags of a month on a figure: where it sits, how it moved, and whether the month is partial. */
export function monthTags(t: TFunction, metric: Metric, i: number): TagSpec[] {
  const list = [trendTag(t, metric, i), rangeTag(t, metric, i), i >= FULL ? partialTag(t) : null];
  return list.filter((x): x is TagSpec => x !== null);
}
