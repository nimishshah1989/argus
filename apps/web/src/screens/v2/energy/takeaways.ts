import type { TFunction } from 'i18next';
import { fill } from '../../../i18n/fill.js';
import type { EnergyContent, EnergyTile } from '../../analytics/figure-content.js';
import type { Takeaways } from '../../../ui/v2/takeaway.js';
import type { Translate } from '../figures/read.js';
import { takeawayFor, type Item } from '../insight.js';
import { kvaText } from './sweep.js';

/** The Energy screen's takeaways and yardsticks, split out of adapter.ts to keep it under the size limit. */
export const heaviest = (
  tiles: EnergyTile[],
  by: (tile: EnergyTile) => number,
): EnergyTile | undefined =>
  tiles.reduce<EnergyTile | undefined>(
    (top, tile) => (tile.machines > 0 && (top === undefined || by(tile) > by(top)) ? tile : top),
    undefined,
  );

export type Totals = { connected: number; running: number; machines: number };
export type Names3 = { cell: (tile: EnergyTile) => string; place: (tile: EnergyTile) => string };

/** The plant's totals: every machine sits in exactly one cell tile, so the cell tiles add up to the plant. */
export const totalsOf = (cells: EnergyTile[]): Totals => ({
  connected: cells.reduce((sum, tile) => sum + tile.connectedKva, 0),
  running: cells.reduce((sum, tile) => sum + tile.runningKva, 0),
  machines: cells.reduce((sum, tile) => sum + tile.machines, 0),
});

export type Picks = { top: EnergyTile | undefined; densest: EnergyTile | undefined };

/** The tiles that hold machines, as a takeaway reads them: the figure is the tile's value, shown as the tile prints it. */
export function itemsOf(
  tiles: EnergyTile[],
  value: (tile: EnergyTile) => number,
  name: (tile: EnergyTile) => string,
): Item[] {
  return tiles
    .filter((tile) => tile.machines > 0)
    .map((tile) => ({ name: name(tile), value: value(tile), shown: kvaText(value(tile)) }));
}

/** One computed line per map (ADR 0035, ticket 660): concentration where the load adds up, else the outlier. */
export function takeawaysOf(content: EnergyContent, names: Names3, t: Translate): Takeaways {
  const kva = (tile: EnergyTile) => tile.connectedKva;
  return {
    cell: takeawayFor(
      itemsOf(content.byCell.tiles, kva, names.cell),
      { worse: 'high', additive: true },
      t,
    ),
    location: takeawayFor(
      itemsOf(content.byLocation.tiles, kva, names.place),
      { worse: 'high', additive: true },
      t,
    ),
    machine: takeawayFor(
      itemsOf(content.byMachine.tiles, (tile) => tile.avgConnectedKva, names.cell),
      { worse: 'high' },
      t,
    ),
  };
}

/** The kit's share yardstick, "20% of 2,812.0 KVA"; none when nothing is connected, so there is no division by zero. */
export function shareYardstick(part: number, total: Totals, t: TFunction): string | undefined {
  if (total.connected === 0) return undefined;
  const whole = `${kvaText(total.connected)} ${t('analytics.energy.unit')}`;
  return fill(t('insight.yardstick.share'), {
    pct: Math.round((part / total.connected) * 100),
    total: whole,
  });
}

/** The kit's average yardstick, "Average 22.3 KVA": the plant's connected load over its machines; none with no machine. */
export function averageYardstick(total: Totals, t: TFunction): string | undefined {
  if (total.machines === 0) return undefined;
  const value = `${kvaText(total.connected / total.machines)} ${t('analytics.energy.unit')}`;
  return fill(t('insight.yardstick.average'), { value });
}
