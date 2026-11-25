import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * One row of a ranked list (ADR 0036 R20, R12). `value` places the bar; `valueText`/`countText`/`moneyText` are the
 * engine's printed figures. `rest` marks the "everything else" row: drawn last, never inside the half.
 */
export type RankedRow = {
  key: string;
  label: ReactNode;
  value: number;
  valueText: string;
  countText?: string;
  moneyText?: string;
  rest?: boolean;
};

/** A row with its share of the total (0..1) and its bar width against the largest value (0..1). */
export type RankedBar = RankedRow & { share: number; width: number };

const positive = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 0);

/**
 * Worst first: finite values ≥ 0 by value, largest first (ties keep their input order); then negative or NaN values
 * in input order with share 0 and width 0; `rest` rows always last. `share = value / sum` and
 * `width = value / largest`, where sum and largest are over the finite positive values (rest rows included);
 * both 0 when there is nothing positive.
 */
export function rankRows(rows: RankedRow[]): RankedBar[] {
  const sum = rows.reduce((a, r) => a + positive(r.value), 0);
  const largest = Math.max(0, ...rows.map((r) => positive(r.value)));
  const group = (r: RankedRow): number =>
    r.rest ? 2 : Number.isFinite(r.value) && r.value >= 0 ? 0 : 1;
  return rows
    .map((r) => ({
      ...r,
      share: sum ? positive(r.value) / sum : 0,
      width: largest ? positive(r.value) / largest : 0,
    }))
    .sort((a, b) => group(a) - group(b) || (group(a) === 0 ? b.value - a.value : 0));
}

/**
 * How many leading values make up half the total: the fewest whose running sum first reaches ≥ half of the sum of
 * all finite positive values (negative/NaN count as 0). A value whose `rest[i]` is true is never counted: the run
 * stops there, and if the values before it never reach half the answer is 0. 0 when the total is 0.
 */
export function halfBars(values: readonly number[], rest: readonly boolean[] = []): number {
  const total = values.reduce((a, v) => a + positive(v), 0);
  let run = 0;
  for (let i = 0; total > 0 && i < values.length && !rest[i]; i++) {
    run += positive(values[i] as number);
    if (run * 2 >= total) return i + 1;
  }
  return 0;
}

/**
 * A ranked list (ADR 0036 R20): `<ol class="v2-ranked" aria-label={label}>`, one `<li class="v2-ranked-row">` per
 * `rankRows` row with an inline bar (`.v2-cellbar` pattern, width = `width`) and the text
 * `valueText · {round(share × 100)}% · countText` (missing parts skipped), then `moneyText` when given. After the last
 * of the first `halfBars` rows, one `<li class="v2-half" aria-label={t('insight.half')}>`; none when `halfBars` is 0.
 * `data-half` on the rows inside the half (their bars are bad), `data-rest` on a rest row.
 */
export function RankedBars({ rows, label }: { rows: RankedRow[]; label: string }): ReactNode {
  const { t } = useTranslation();
  const ranked = rankRows(rows);
  const half = halfBars(
    ranked.map((r) => r.value),
    ranked.map((r) => !!r.rest),
  );
  return (
    <ol className="v2-ranked" aria-label={label}>
      {ranked.flatMap((r, i) => {
        const text = [r.valueText, `${Math.round(r.share * 100)}%`, r.countText]
          .filter(Boolean)
          .join(' · ');
        const item = (
          <li
            key={r.key}
            className="v2-ranked-row"
            data-half={i < half ? '' : undefined}
            data-rest={r.rest ? '' : undefined}
          >
            <span className="v2-ranked-label">{r.label}</span>
            <span className="v2-ranked-track" aria-hidden="true">
              <span style={{ width: `${r.width * 100}%` }} />
            </span>
            <span className="v2-ranked-text">
              {text}
              {r.moneyText ? <span className="v2-ranked-money">{r.moneyText}</span> : null}
            </span>
          </li>
        );
        return i + 1 === half
          ? [item, <li key="half" className="v2-half" aria-label={t('insight.half')} />]
          : [item];
      })}
    </ol>
  );
}
