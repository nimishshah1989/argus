import type { TFunction } from 'i18next';
import type { MessageKey } from '@uptimo/shared/i18n';
import type { FigureContent } from './figure-content.js';

/**
 * The `pm-compliance` figure's content (ticket 50b, R8/R16): one row of the two rates over the window the engine
 * computed, with the counts behind them in the caption. It is split from `figure-content.ts` for the same reason
 * `page-content.ts` is — that file sits at the 400-line rail — and it is the interim PM group page 50c's calendar
 * page replaces. The percentages are one-decimal numbers or `null`; a null prints `—`, never 0 %.
 */

type ObjectValue = Record<string, unknown>;

/** The catalogue keys this mapper prints; typed so a missing key is a compile error, not an English label. */
const KEY = {
  period: 'pm.compliance.period',
  pm: 'pm.compliance.pm',
  schedule: 'pm.compliance.schedule',
  counts: 'pm.compliance.counts',
  empty: 'pm.compliance.empty',
} as const satisfies Record<string, MessageKey>;

const oneDecimal = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const DASH = '—';

/** A rate as the page prints it: one decimal and a `%`, or the dash when there is no denominator (R16). */
function rateOf(value: unknown): string {
  const rate = typeof value === 'number' ? value : Number.NaN;
  return Number.isFinite(rate) ? `${oneDecimal.format(rate)} %` : DASH;
}

const countOf = (value: ObjectValue, key: string): number => {
  const count = Number(value[key]);
  return Number.isFinite(count) ? count : 0;
};

/** The interim table: the period, the two rates, and the counts behind them. */
export function pmComplianceContent(value: ObjectValue, t: TFunction): FigureContent | null {
  const pm = typeof value.pm === 'object' && value.pm !== null ? (value.pm as ObjectValue) : null;
  const schedule =
    typeof value.schedule === 'object' && value.schedule !== null
      ? (value.schedule as ObjectValue)
      : null;
  if (pm === null || schedule === null) return null;
  const pmEligible = countOf(pm, 'eligible');
  const plannedEligible = countOf(schedule, 'eligible');
  const from = typeof value.from === 'string' ? value.from : '';
  const to = typeof value.to === 'string' ? value.to : '';
  // A window with no planned work order has an honest answer and nothing to tabulate: the page says so in words.
  if (pmEligible === 0 && plannedEligible === 0) return { kind: 'text', text: t(KEY.empty) };
  return {
    kind: 'table',
    header: [t(KEY.period), t(KEY.pm), t(KEY.schedule)],
    rows: [[`${from} – ${to}`, rateOf(pm.pct), rateOf(schedule.pct)]],
    caption: t(KEY.counts, {
      onTime: countOf(pm, 'onTime'),
      pmEligible,
      done: countOf(schedule, 'done'),
      plannedEligible,
    }),
  };
}
