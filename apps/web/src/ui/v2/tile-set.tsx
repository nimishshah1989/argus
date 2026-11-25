import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { fill } from '../../i18n/fill.js';
import { KpiCard, type KpiData } from './kpi-card.js';
import { ShowDetail } from './show-detail.js';

/** A tile and its figure as a number, so the set can tell when every figure is zero. */
export type TileItem = { kpi: KpiData; n: number };

/** True only for a set of one or more tiles whose figures are all exactly 0 (NaN is not zero). */
export function allZero(items: TileItem[]): boolean {
  return items.length > 0 && items.every((i) => i.n === 0);
}

/** The first `max` tiles go above the fold; the rest under "Show detail" (ADR 0036 R1). */
export function splitTiles(items: TileItem[], max = 4): { shown: TileItem[]; folded: TileItem[] } {
  const cut = Math.max(0, max);
  return { shown: items.slice(0, cut), folded: items.slice(cut) };
}

/**
 * A page's tiles (ADR 0036 R1, R10). All zero → one `<p class="v2-zero-line">` saying `insight.tiles.allZero`
 * ({n}: how many, {labels}: their labels joined by ", "), no cards. Otherwise `KpiCard`s for `shown`, then the
 * `folded` ones inside `<ShowDetail>`; no disclosure when nothing is folded. Wrapper: `<div class="v2-tile-set">`.
 */
export function TileSet({ items, max = 4 }: { items: TileItem[]; max?: number }): ReactElement {
  const { t } = useTranslation();
  if (allZero(items)) {
    const labels = items.map((i) => i.kpi.label).join(', ');
    return (
      <p className="v2-zero-line">
        {fill(t('insight.tiles.allZero'), { n: items.length, labels })}
      </p>
    );
  }
  const { shown, folded } = splitTiles(items, max);
  return (
    <div className="v2-tile-set">
      {shown.map((i) => (
        <KpiCard key={i.kpi.id} kpi={i.kpi} />
      ))}
      {folded.length > 0 && (
        <ShowDetail>
          {folded.map((i) => (
            <KpiCard key={i.kpi.id} kpi={i.kpi} />
          ))}
        </ShowDetail>
      )}
    </div>
  );
}
