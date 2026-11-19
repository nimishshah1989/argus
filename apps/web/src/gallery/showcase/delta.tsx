import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { change, fixed, monthLong, type Change, type Metric } from './data.js';

/** The arrow's stroke, shared by the component and the tooltip's markup. */
export const arrowPath = (dir: Change['dir']): string =>
  dir === 'flat'
    ? 'M2.5 6h7'
    : dir === 'up'
      ? 'M6 10V2.5M2.5 6 6 2.5 9.5 6'
      : 'M6 2v7.5M2.5 6 6 9.5 9.5 6';

/** An arrow drawn for the direction the figure moved; its colour says whether that is good (meaning, not up or down). */
export function Arrow({ dir }: { dir: Change['dir'] }) {
  return (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      aria-hidden="true"
      className="sc-arrow"
      data-dir={dir}
    >
      <path d={arrowPath(dir)} />
    </svg>
  );
}

/** `0.15 pts`, `12.5 h` or `7`: a difference in the metric's own unit. */
export function amount(t: TFunction, metric: Metric, n: number): string {
  const text = fixed(n, metric.digits);
  if (metric.unit === '%') return `${text} ${t('unit.pts')}`;
  return metric.unit === 'h' ? `${text} ${t('unit.h')}` : text;
}

/** The change in words: `0.15 pts more than Sep`, so colour and arrow are never the only carriers. */
export function changeText(t: TFunction, metric: Metric, ch: Change, short = false): string {
  const month = monthLong(ch.from).slice(0, 3);
  const to = monthLong(ch.from + 1).slice(0, 3);
  if (ch.dir === 'flat') return t('delta.same', { month, to });
  if (short)
    return t(ch.dir === 'up' ? 'delta.up' : 'delta.down', {
      n: amount(t, metric, ch.delta),
      month,
    });
  return t(ch.dir === 'up' ? 'delta.more' : 'delta.less', {
    n: amount(t, metric, ch.delta),
    month,
    to,
  });
}

/** The change of month `i` against the month before: arrow, words, and a hidden verdict for a screen reader. */
export function Delta({ metric, i }: { metric: Metric; i: number }) {
  const { t } = useTranslation('showcase');
  const ch = change(metric, i);
  if (!ch) return <span className="sc-delta">{t('delta.none')}</span>;
  const verdict =
    ch.tone === 'flat'
      ? t('delta.planned')
      : t(ch.tone === 'good' ? 'delta.better' : 'delta.worse');
  return (
    <span className="sc-delta" data-tone={ch.tone}>
      <Arrow dir={ch.dir} />
      <span>{changeText(t, metric, ch)}</span>
      {ch.dir !== 'flat' && ch.tone !== 'flat' ? <span className="sr-only"> {verdict}</span> : null}
    </span>
  );
}
