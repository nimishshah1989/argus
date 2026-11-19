import type { TFunction } from 'i18next';
import {
  AS_OF_TEXT,
  BIG_HOURS,
  FULL,
  S,
  YEAR_TEXT,
  change,
  fixed,
  monthLong,
  rangePos,
  usualRange,
  type Metric,
} from './data.js';
import { amount, arrowPath, changeText } from './delta.js';
import { FAMILY } from './families.js';
import { monthTags, tagHtml } from './tags.js';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (text: string): string => text.replace(/[&<>"]/g, (c) => ESC[c]!);

const row = (label: string, value: string): string => `<dt>${esc(label)}</dt><dd>${value}</dd>`;

/**
 * The trend's tooltip as a designed card: the month, the figure with its change and verdict, then the facts the
 * chart does not draw (where it sits in its usual range, how many breakdowns, the top cause and the worst machine).
 * Six lines, one more only for a month that had a breakdown of a day or longer.
 */
export function tipHtml(t: TFunction, metric: Metric, i: number): string {
  const value = metric.values[i] ?? null;
  const detail = S.detail[i]!;
  const ch = change(metric, i);
  const [lo, hi] = usualRange(metric);
  const unit = metric.unit === '' ? '' : ` <i>${metric.unit}</i>`;
  const arrow = ch
    ? `<span class="sc-delta" data-tone="${ch.tone}"><svg viewBox="0 0 12 12" width="12" height="12" class="sc-arrow" data-dir="${ch.dir}"><path d="${arrowPath(ch.dir)}"/></svg>${esc(changeText(t, metric, ch))}</span>`
    : '';
  const pos = rangePos(metric, value);
  const range = pos
    ? t(`tip.${pos}`, { lo: fixed(lo, metric.digits), hi: fixed(hi, metric.digits) })
    : '';
  const lines = [
    row(t('tip.range'), esc(range)),
    row(t('tip.breakdowns'), fixed(detail.breakdowns, 0)),
    detail.topCause
      ? row(
          t('tip.cause'),
          `${esc(detail.topCause.name)} <b>${fixed(detail.topCause.hours, 1)} h</b>`,
        )
      : '',
    detail.worstMachine
      ? row(
          t('tip.machine'),
          `${esc(detail.worstMachine.id)} <b>${fixed(detail.worstMachine.hours, 1)} h</b>`,
        )
      : '',
    detail.longest && detail.longest.hours >= BIG_HOURS
      ? row(
          t('tip.longest'),
          `${esc(detail.longest.machine)} <b>${amount(t, { ...metric, unit: 'h', digits: 1 }, detail.longest.hours)}</b>`,
        )
      : '',
  ];
  const running =
    i >= FULL
      ? `<em>${esc(t('tip.running', { date: AS_OF_TEXT.replace(` ${YEAR_TEXT}`, '') }))}</em>`
      : '';
  const tags = monthTags(t, metric, i).map(tagHtml).join('');
  return `<div class="sc-tip" data-family="${FAMILY[metric.id]}"><header>${esc(monthLong(i))} ${YEAR_TEXT}${running}</header><p class="sc-tip-value"><b>${fixed(value, metric.digits)}</b>${unit}</p>${arrow}${tags ? `<p class="sc-tags">${tags}</p>` : ''}<dl>${lines.join('')}</dl></div>`;
}
