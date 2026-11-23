import i18n from 'i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { contentOf, type EnergyGrid } from '../../analytics/figure-content.js';
import type { LoadBasis } from '../../../ui/v2/domain/rows-behind-adapter.js';
import { runningFrom } from '../../analytics/machine-record.js';

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

/** A machine's own efficiency from its metadata: a number, or a number written as text; blank (`''`) or missing is none. */
function ownEfficiency(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * The engine's running-load rule for one machine (`a5-energy`): its rated power at its own efficiency (clamped 0 to 100),
 * or at the plant's factor when it has none. The tile's own figure stays the engine's; a test holds the two together.
 */
export const loadBasis = (factorPct: number): LoadBasis => ({
  running: ({ powerKw, metadata }) => {
    const own = ownEfficiency(metadata.efficiency);
    return runningFrom(powerKw, own === null ? factorPct : Math.min(100, Math.max(0, own)));
  },
});

/** The load basis of the energy figure's machines (its efficiency factor, in percent); undefined for any other figure. */
export function energyLoad(figure: Figure): LoadBasis | undefined {
  if (figure.status !== 'ready' || figure.key !== 'a5-energy') return undefined;
  const content = contentOf(figure, i18n.t.bind(i18n));
  return content?.kind === 'energy' ? loadBasis(content.effFactorPct) : undefined;
}
