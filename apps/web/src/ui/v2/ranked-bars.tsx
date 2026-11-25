/* eslint-disable @typescript-eslint/no-unused-vars -- skeleton: the builder fills the bodies and deletes this line */
import type { ReactNode } from 'react';

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

/**
 * Worst first: finite values ≥ 0 by value, largest first (ties keep their input order); then negative or NaN values
 * in input order with share 0 and width 0; `rest` rows always last. `share = value / sum` and
 * `width = value / largest`, where sum and largest are over the finite positive values (rest rows included);
 * both 0 when there is nothing positive.
 */
export function rankRows(rows: RankedRow[]): RankedBar[] {
  throw new Error('not implemented');
}

/**
 * How many leading values make up half the total: the fewest whose running sum first reaches ≥ half of the sum of
 * all finite positive values (negative/NaN count as 0). A value whose `rest[i]` is true is never counted: the run
 * stops there, and if the values before it never reach half the answer is 0. 0 when the total is 0.
 */
export function halfBars(values: readonly number[], rest: readonly boolean[] = []): number {
  throw new Error('not implemented');
}

/**
 * A ranked list (ADR 0036 R20): `<ol class="v2-ranked" aria-label={label}>`, one `<li class="v2-ranked-row">` per
 * `rankRows` row with an inline bar (`.v2-cellbar` pattern, width = `width`) and the text
 * `valueText · {round(share × 100)}% · countText` (missing parts skipped), then `moneyText` when given. After the last
 * of the first `halfBars` rows, one `<li class="v2-half" aria-label={t('insight.half')}>`; none when `halfBars` is 0.
 * Row markup (styles in `ranked-bars.css`, written by Plan, auto-loaded by `sheets.ts`):
 * `<span class="v2-ranked-label">{label}</span>`,
 * `<span class="v2-ranked-track" aria-hidden="true"><span style={{ width: `${width × 100}%` }} /></span>`,
 * `<span class="v2-ranked-text">{the text}{moneyText ? <span class="v2-ranked-money">{moneyText}</span> : null}</span>`;
 * `data-half` on the rows inside the half (their bars are bad), `data-rest` on a rest row.
 */
export function RankedBars({ rows, label }: { rows: RankedRow[]; label: string }): ReactNode {
  throw new Error('not implemented');
}
