import i18n from 'i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { contentOf, type EnergyGrid } from '../../analytics/figure-content.js';

type Figure = FiguresReply['figures'][number];

/** A tile of a figure's map: `a5-energy:cell:3` names the figure, the axis and the tile, so a drawer can open just its rows. */
export type TileRef = { figure: string; axis: EnergyGrid['axis']; tile: string };

const AXES: readonly EnergyGrid['axis'][] = ['cell', 'location'];

export const tileAddress = ({ figure, axis, tile }: TileRef): string => `${figure}:${axis}:${tile}`;

/** The tile a drawer address names; null for a plain figure key. The tile's name may hold a colon, so only the first two split. */
export function parseTile(address: string): TileRef | null {
  const [figure, axis, ...rest] = address.split(':');
  if (figure === undefined || rest.length === 0) return null;
  const found = AXES.find((candidate) => candidate === axis);
  return found === undefined ? null : { figure, axis: found, tile: rest.join(':') };
}

/** The machines the engine put in that tile, exactly: a tile never counts a machine its figure does not list. */
export function tileMachines(figure: Figure, ref: TileRef): string[] {
  if (figure.status !== 'ready') return [];
  const content = contentOf(figure, i18n.t.bind(i18n));
  if (content?.kind !== 'energy') return [];
  const grid = ref.axis === 'cell' ? content.byCell : content.byLocation;
  return grid.tiles.find((tile) => tile.key === ref.tile)?.machineIds ?? [];
}
