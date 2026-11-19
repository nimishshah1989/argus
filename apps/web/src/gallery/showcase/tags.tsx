import type { TFunction } from 'i18next';
import { FULL, change, monthLong, rangePos, type Metric } from './data.js';

/** good is green, watch amber, bad red, neutral grey (DESIGN.md tone grammar). */
export type TagTone = 'good' | 'watch' | 'bad' | 'neutral';
export type TagIcon = 'check' | 'alert' | 'cross' | 'dash' | 'clock';

/** A tag is a tone, an icon and a word: colour is never the only carrier, so each tone has its own shape. */
export interface TagSpec {
  tone: TagTone;
  icon: TagIcon;
  word: string;
  /** Hidden extra for a screen reader, such as the month a tag is about. */
  more?: string;
}

const ICON: Record<TagIcon, string> = {
  check: 'M2.5 6.5 5 9l4.5-5.5',
  alert: 'M6 2 10.5 10h-9ZM6 5.2v2.3M6 8.7h.01',
  cross: 'M3 3l6 6M9 3 3 9',
  dash: 'M3 6h6',
  clock: 'M6 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM6 4v2.2l1.4.9',
};
const TONE_ICON: Record<TagTone, TagIcon> = {
  good: 'check',
  watch: 'alert',
  bad: 'cross',
  neutral: 'dash',
};
const spec = (tone: TagTone, word: string, more?: string, icon?: TagIcon): TagSpec => ({
  tone,
  icon: icon ?? TONE_ICON[tone],
  word,
  more,
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

const esc = (text: string): string => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** The tag as markup for an ECharts tooltip, which cannot hold a component. */
export function tagHtml(tag: TagSpec): string {
  const more = tag.more ? `<span class="sr-only"> ${esc(tag.more)}</span>` : '';
  return `<span class="sc-tag" data-tone="${tag.tone}"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="${ICON[tag.icon]}"/></svg>${esc(tag.word)}${more}</span>`;
}

/** The icon of a tag on its own, for a row header: the word stays in the page for a screen reader. */
export function TagGlyph({ tag }: { tag: TagSpec }) {
  return (
    <>
      <svg
        viewBox="0 0 12 12"
        width="12"
        height="12"
        aria-hidden="true"
        className="sc-glyph"
        data-tone={tag.tone}
      >
        <path d={ICON[tag.icon]} />
      </svg>
      <span className="sr-only"> {tag.word}</span>
    </>
  );
}

/** One status pill: a soft tint, an icon and a word. */
export function Tag({ tag }: { tag: TagSpec }) {
  return (
    <span className="sc-tag" data-tone={tag.tone} data-testid="tag">
      <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
        <path d={ICON[tag.icon]} />
      </svg>
      {tag.word}
      {tag.more ? <span className="sr-only"> {tag.more}</span> : null}
    </span>
  );
}

export function Tags({ list }: { list: TagSpec[] }) {
  return list.length === 0 ? null : (
    <span className="sc-tags">
      {list.map((tag) => (
        <Tag key={tag.word} tag={tag} />
      ))}
    </span>
  );
}
