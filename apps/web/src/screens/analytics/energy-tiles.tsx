import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Card } from '../../ui/card.js';
import { Chart } from '../../ui/chart/chart.js';
import type { ChartSpec } from '../../ui/chart/use-chart.js';
import { KpiTile } from '../../ui/elements/index.js';
import type { EnergyGrid, EnergyTile } from './figure-content.js';

/** A tile's pick: one axis of the figure's own machine drill reply. */
export type TilePick = { axis: 'cell' | 'location'; key: string };
export type GridId = 'cell' | 'location' | 'machine';

const oneDecimal = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const kva = (value: number) => oneDecimal.format(value);

/** The tile's name: the key, or the words for a machine with no cell. */
function nameOf(tile: EnergyTile, t: TFunction): string {
  return tile.key === '—' ? t('analytics.energy.noCell') : tile.key;
}

/** The lines under a tile's value: the running load, the machine count and the per-machine average. */
function noteOf(tile: EnergyTile, showRunning: boolean, t: TFunction): string {
  const machines =
    tile.machines === 1
      ? t('analytics.energy.oneMachine', { count: tile.machines })
      : t('analytics.energy.machines', { count: tile.machines });
  return [
    showRunning
      ? `${t('analytics.energy.running')}: ${kva(tile.runningKva)} ${t('analytics.energy.unit')}`
      : null,
    machines,
    t('analytics.energy.avg', { value: kva(tile.avgConnectedKva) }),
  ]
    .filter((part) => part !== null)
    .join(' · ');
}

/** One grid's tile: the connected load as the figure, the rest as a quiet note; a tile with machines opens its rows. */
function EnergyTileView({
  tile,
  gridId,
  showRunning,
  onPick,
}: {
  tile: EnergyTile;
  gridId: GridId;
  showRunning: boolean;
  onPick?: () => void;
}) {
  const { t } = useTranslation();
  const empty = tile.machines === 0;
  return (
    <li data-tile={`${gridId}:${tile.key}`}>
      <KpiTile
        label={nameOf(tile, t)}
        value={empty ? null : tile.connectedKva}
        format={kva}
        unit={`${t('analytics.energy.connected')} ${t('analytics.energy.unit')}`}
        note={empty ? t('analytics.energy.noMachines') : noteOf(tile, showRunning, t)}
        {...(empty || onPick === undefined ? {} : { onOpen: onPick })}
      />
    </li>
  );
}

/** Connected beside running load for each tile of a load grid, the picture the tiles' colour used to give. */
function loadChart(grid: EnergyGrid, title: string, t: TFunction): ChartSpec {
  const unit = t('analytics.energy.unit');
  const present = (value: number, tile: EnergyTile) => (tile.machines === 0 ? undefined : value);
  return {
    kind: 'bar',
    title,
    categoryLabel: title,
    categories: grid.tiles.map((tile) => nameOf(tile, t)),
    valueLabel: unit,
    series: [
      {
        name: `${t('analytics.energy.connected')} ${unit}`,
        values: grid.tiles.map((tile) => present(tile.connectedKva, tile)),
      },
      {
        name: `${t('analytics.energy.running')} ${unit}`,
        values: grid.tiles.map((tile) => present(tile.runningKva, tile)),
      },
    ],
    legend: true,
    draw: true,
  };
}

/** One grid: its title, what it shows, the load chart when it has a running load, and its tiles. */
export function EnergyGridView({
  grid,
  id,
  title,
  description,
  onPick,
}: {
  grid: EnergyGrid;
  id: GridId;
  title: string;
  description: string;
  /** Absent on the average grid: the platform drills the two load grids, not the normalized one. */
  onPick?: (key: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-body font-semibold">{title}</h3>
        <p className="text-footnote text-neutral-600">{description}</p>
      </div>
      {grid.showRunning ? (
        <Card>
          <Chart spec={loadChart(grid, title, t)} quietTitle />
        </Card>
      ) : null}
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {grid.tiles.map((tile) => (
          <EnergyTileView
            key={tile.key}
            tile={tile}
            gridId={id}
            showRunning={grid.showRunning}
            {...(onPick === undefined ? {} : { onPick: () => onPick(tile.key) })}
          />
        ))}
      </ul>
    </section>
  );
}
