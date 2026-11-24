/* eslint-disable @typescript-eslint/no-unused-vars -- skeleton: the builder fills the bodies and deletes this line */
import type { ReactElement } from 'react';
import type { KpiData } from './kpi-card.js';

/** A tile and its figure as a number, so the set can tell when every figure is zero. */
export type TileItem = { kpi: KpiData; n: number };

/** True only for a set of one or more tiles whose figures are all exactly 0 (NaN is not zero). */
export function allZero(items: TileItem[]): boolean {
  throw new Error('not implemented');
}

/** The first `max` tiles go above the fold; the rest under "Show detail" (ADR 0036 R1). */
export function splitTiles(items: TileItem[], max = 4): { shown: TileItem[]; folded: TileItem[] } {
  throw new Error('not implemented');
}

/**
 * A page's tiles (ADR 0036 R1, R10). All zero → one `<p class="v2-zero-line">` saying `insight.tiles.allZero`
 * ({n}: how many, {labels}: their labels joined by ", "), no cards. Otherwise `KpiCard`s for `shown`, then the
 * `folded` ones inside `<ShowDetail>`; no disclosure when nothing is folded. Wrapper: `<div class="v2-tile-set">`.
 */
export function TileSet({ items, max = 4 }: { items: TileItem[]; max?: number }): ReactElement {
  throw new Error('not implemented');
}
