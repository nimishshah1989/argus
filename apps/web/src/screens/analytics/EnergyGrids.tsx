import { useTranslation } from 'react-i18next';
import type { EnergyGrid, EnergyTile } from './figure-content.js';

/** A tile click's filter: one axis of the figure's own machine drill reply. */
export type TilePick = { axis: 'cell' | 'location'; key: string };
export type GridId = 'cell' | 'location' | 'machine';

const CELL = 'cell';
const LOCATION = 'location';
const MACHINE = 'machine';

const oneDecimal = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * The platform's flat green scale: light green for a low load, dark green for a high one, mid green for a grid
 * whose loads are all equal. Kept as the platform's own formula because A5's tile colour is the figure's data.
 */
export function heatT(value: number, min: number, max: number): number {
  return max <= min ? 0.5 : Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export function heatColor(value: number, min: number, max: number): string {
  const t = heatT(value, min, max);
  return `hsl(${140 + t * 10}, ${45 + t * 30}%, ${88 - t * 66}%)`;
}

/** Dark text on a light tile, white on a dark one, as the platform paints its heat text. */
export function heatInk(value: number, min: number, max: number): string {
  return heatT(value, min, max) > 0.45 ? '#ffffff' : '#14532d';
}

/** The scale of one grid: its non-empty tiles' connected load, exactly as the platform ranges them. */
function rangeOf(grid: EnergyGrid): [number, number] {
  const values = grid.tiles.filter((tile) => tile.machines > 0).map((tile) => tile.connectedKva);
  return values.length === 0 ? [0, 0] : [Math.min(...values), Math.max(...values)];
}

function TileBody({
  name,
  tile,
  showRunning,
}: {
  name: string;
  tile: EnergyTile;
  showRunning: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <span className="text-caption font-bold opacity-90">{name}</span>
      <span className="text-title2 font-bold leading-tight">
        {oneDecimal.format(tile.connectedKva)}
      </span>
      <span className="text-caption opacity-85">
        {t('analytics.energy.connected')} {t('analytics.energy.unit')}
      </span>
      {showRunning ? (
        <span className="text-caption opacity-85">
          {t('analytics.energy.running')}: {oneDecimal.format(tile.runningKva)}{' '}
          {t('analytics.energy.unit')}
        </span>
      ) : null}
      <span className="text-caption opacity-85">
        {tile.machines === 1
          ? t('analytics.energy.oneMachine', { count: tile.machines })
          : t('analytics.energy.machines', { count: tile.machines })}{' '}
        · {t('analytics.energy.avg', { value: oneDecimal.format(tile.avgConnectedKva) })}
      </span>
    </>
  );
}

function Tile({
  tile,
  gridId,
  range,
  showRunning,
  selected,
  onPick,
}: {
  tile: EnergyTile;
  gridId: GridId;
  range: [number, number];
  showRunning: boolean;
  selected: boolean;
  /** Absent on the average grid: the platform drills the two load grids, not the normalized one. */
  onPick?: () => void;
}) {
  const { t } = useTranslation();
  const name = tile.key === '—' ? t('analytics.energy.noCell') : tile.key;
  const frame = 'flex min-h-28 flex-col justify-center gap-0.5 rounded-xl p-3';
  if (tile.machines === 0)
    return (
      <li>
        <div
          data-tile={`${gridId}:${tile.key}`}
          className={`${frame} bg-neutral-200 text-neutral-600`}
        >
          <span className="text-caption font-bold">{name}</span>
          <span className="text-footnote">{t('analytics.energy.noMachines')}</span>
        </div>
      </li>
    );
  const style = {
    backgroundColor: heatColor(tile.connectedKva, range[0], range[1]),
    color: heatInk(tile.connectedKva, range[0], range[1]),
  };
  return (
    <li>
      {onPick === undefined ? (
        <div data-tile={`${gridId}:${tile.key}`} style={style} className={frame}>
          <TileBody name={name} tile={tile} showRunning={showRunning} />
        </div>
      ) : (
        <button
          type="button"
          data-tile={`${gridId}:${tile.key}`}
          aria-pressed={selected}
          onClick={onPick}
          style={style}
          className={`${frame} w-full text-left`}
        >
          <TileBody name={name} tile={tile} showRunning={showRunning} />
        </button>
      )}
    </li>
  );
}

function GridCard({
  grid,
  id,
  title,
  description,
  selected,
  onPick,
}: {
  grid: EnergyGrid;
  id: GridId;
  title: string;
  description: string;
  selected: TilePick | null;
  onPick?: (key: string) => void;
}) {
  const range = rangeOf(grid);
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-title3 font-semibold">{title}</h3>
      <p className="text-footnote text-neutral-600">{description}</p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {grid.tiles.map((tile) => (
          <Tile
            key={tile.key}
            tile={tile}
            gridId={id}
            range={range}
            showRunning={grid.showRunning}
            selected={selected?.axis === grid.axis && selected.key === tile.key}
            {...(onPick === undefined ? {} : { onPick: () => onPick(tile.key) })}
          />
        ))}
      </ul>
    </section>
  );
}

/** The three grids, in the platform's order: cell, location, then the per-machine average by cell. */
export function Grids({
  content,
  selected,
  onPick,
}: {
  content: {
    byCell: EnergyGrid;
    byLocation: EnergyGrid;
    byMachine: EnergyGrid;
    effFactorPct: number;
  };
  selected: TilePick | null;
  onPick: (axis: TilePick['axis'], key: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <GridCard
        grid={content.byCell}
        id={CELL}
        title={t('analytics.energy.cellTitle')}
        description={t('analytics.energy.cellDescription', { pct: content.effFactorPct })}
        selected={selected}
        onPick={(key) => onPick(CELL, key)}
      />
      <GridCard
        grid={content.byLocation}
        id={LOCATION}
        title={t('analytics.energy.locationTitle')}
        description={t('analytics.energy.locationDescription')}
        selected={selected}
        onPick={(key) => onPick(LOCATION, key)}
      />
      <GridCard
        grid={content.byMachine}
        id={MACHINE}
        title={t('analytics.energy.machineTitle')}
        description={t('analytics.energy.machineDescription')}
        selected={selected}
      />
    </>
  );
}
