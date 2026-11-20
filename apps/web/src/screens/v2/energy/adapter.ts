import type { TFunction } from 'i18next';
import type { ChartSpec } from '../../../ui/chart/use-chart.js';
import { fill } from '../../../i18n/fill.js';
import { levelOf, type HeatLevel } from '../../../ui/v2/domain/heat-matrix.js';
import type { HeatTileData } from '../../../ui/v2/domain/heat-tiles.js';
import type { Drill } from '../../../ui/v2/drill.js';
import {
  contentOf,
  type EnergyContent,
  type EnergyGrid,
  type EnergyTile,
} from '../../analytics/figure-content.js';
import type { FigureData } from '../../../ui/v2/figure-tile.js';
import type { Translate } from '../figures/read.js';
import { drillFor } from '../rows-behind/drill.js';
import { tileAddress } from '../rows-behind/tile.js';
import { figureOf, shortDate, type FiguresPart } from '../printed-page/printed.js';
import { say, strong } from '../printed-page/segs.js';
import { verdictOf } from '../printed-page/verdict.js';
import type { EnergyGridModel, EnergyModel } from './model.js';

/** The engine's figure this screen is built from. */
export const FIGURE = 'a5-energy';
const oneDecimal = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** The value as its tile prints it, so the chart's numbers never carry a float sum's tail. */
const rounded = (n: number): number => Number(n.toFixed(1));

type Names = { name: (tile: EnergyTile) => string };

/** The tint of each tile against the grid's own range; a tile with no machines is not tinted. */
function levels(tiles: EnergyTile[], by: (tile: EnergyTile) => number): (HeatLevel | null)[] {
  const filled = tiles.filter((tile) => tile.machines > 0).map(by);
  const [min, max] = [Math.min(...filled), Math.max(...filled)];
  return tiles.map((tile) => (tile.machines > 0 ? levelOf(by(tile), min, max) : null));
}

function loadChart(
  grid: EnergyGrid,
  text: { title: string; axis: string },
  names: Names,
  t: TFunction,
) {
  const { title, axis } = text;
  const unit = t('analytics.energy.unit');
  const shown = grid.tiles.filter((tile) => tile.machines > 0);
  const spec: ChartSpec = {
    kind: 'bar',
    title,
    categoryLabel: axis,
    categories: shown.map(names.name),
    valueLabel: unit,
    series: [
      {
        name: `${t('analytics.energy.connected')} ${unit}`,
        values: shown.map((tile) => rounded(tile.connectedKva)),
      },
      {
        name: `${t('analytics.energy.running')} ${unit}`,
        values: shown.map((tile) => rounded(tile.runningKva)),
      },
    ],
    legend: true,
    draw: true,
  };
  const values = {
    title,
    series: spec.series.map((s) => s.name).join(', '),
    axis: axis.toLocaleLowerCase(),
    n: shown.length,
  };
  return {
    spec,
    sub: fill(t('v2r.chart.sub'), values),
    aria: fill(t('v2r.chart.aria'), values),
  };
}

function machinesLine(tile: EnergyTile, t: TFunction): string {
  return tile.machines === 1
    ? t('analytics.energy.oneMachine', { count: tile.machines })
    : t('analytics.energy.machines', { count: tile.machines });
}

type TileCtx = {
  t: TFunction;
  names: Names;
  /** The machines of a tile open in the drawer; the per-machine map has none. */
  open?: { axis: EnergyGrid['axis'] };
  /** What the tile's figure is: the connected load, or the average per machine. */
  value: (tile: EnergyTile) => number;
  showRunning: boolean;
};

function tileOf(tile: EnergyTile, level: HeatLevel | null, ctx: TileCtx): HeatTileData {
  const { t, names } = ctx;
  const name = names.name(tile);
  const unit = `${t('analytics.energy.connected')} ${t('analytics.energy.unit')}`;
  const empty = tile.machines === 0;
  const lines = empty
    ? [t('analytics.energy.noMachines')]
    : [
        ...(ctx.showRunning
          ? [
              `${t('analytics.energy.running')}: ${oneDecimal(tile.runningKva)} ${t('analytics.energy.unit')}`,
            ]
          : []),
        machinesLine(tile, t),
        t('analytics.energy.avg', { value: oneDecimal(tile.avgConnectedKva) }),
      ];
  const value = empty ? '—' : oneDecimal(ctx.value(tile));
  const drill: Drill | undefined =
    ctx.open && tile.machineIds.length > 0
      ? {
          figure: tileAddress({ figure: FIGURE, axis: ctx.open.axis, tile: tile.key }),
          label: fill(t('v2e.tile.open'), { name }),
        }
      : undefined;
  return {
    id: `${ctx.open?.axis ?? 'machine'}:${tile.key}`,
    name,
    value,
    unit: empty ? '' : unit,
    lines,
    level,
    summary: empty
      ? `${name}. ${lines.join('. ')}`
      : `${name}: ${value} ${unit}. ${lines.join('. ')}`,
    ...(drill ? { drill } : {}),
  };
}

function gridOf(
  id: EnergyGridModel['id'],
  grid: EnergyGrid,
  text: { title: string; sub: string; axis: string },
  ctx: Omit<TileCtx, 'showRunning'>,
): EnergyGridModel {
  const { tiles } = grid;
  const shade = levels(tiles, ctx.value);
  return {
    id,
    title: text.title,
    sub: text.sub,
    chart: grid.showRunning ? loadChart(grid, text, ctx.names, ctx.t) : null,
    tiles: tiles.map((tile, at) =>
      tileOf(tile, shade[at] ?? null, { ...ctx, showRunning: grid.showRunning }),
    ),
  };
}

const heaviest = (tiles: EnergyTile[], by: (tile: EnergyTile) => number): EnergyTile | undefined =>
  tiles.reduce<EnergyTile | undefined>(
    (top, tile) => (tile.machines > 0 && (top === undefined || by(tile) > by(top)) ? tile : top),
    undefined,
  );

type Totals = { connected: number; running: number; machines: number };
type Names3 = { cell: (tile: EnergyTile) => string; place: (tile: EnergyTile) => string };

/** The plant's totals: every machine sits in exactly one cell tile, so the cell tiles add up to the plant. */
const totalsOf = (cells: EnergyTile[]): Totals => ({
  connected: cells.reduce((sum, tile) => sum + tile.connectedKva, 0),
  running: cells.reduce((sum, tile) => sum + tile.runningKva, 0),
  machines: cells.reduce((sum, tile) => sum + tile.machines, 0),
});

type Picks = { top: EnergyTile | undefined; densest: EnergyTile | undefined };

function verdictFor(
  input: { picks: Picks; total: Totals; pct: number; source: string },
  name: (tile: EnergyTile) => string,
  t: TFunction,
) {
  const { picks, total, pct, source } = input;
  const unit = t('analytics.energy.unit');
  const { top, densest } = picks;
  return verdictOf(
    top
      ? say(t('v2e.headline'), {
          cell: strong(name(top)),
          kva: strong(`${oneDecimal(top.connectedKva)} ${unit}`),
          total: `${oneDecimal(total.connected)} ${unit}`,
          machines: String(total.machines),
        })
      : [{ text: t('v2e.noFigures') }],
    [
      say(t('v2e.running'), { pct: String(pct) }),
      densest
        ? say(t('v2e.densest'), {
            cell: name(densest),
            avg: `${oneDecimal(densest.avgConnectedKva)} ${unit}`,
          })
        : null,
    ],
    source,
  );
}

function figuresFor(
  input: { picks: Picks; total: Totals; pct: number },
  name: (tile: EnergyTile) => string,
  t: TFunction,
): FigureData[] {
  const { picks, total, pct } = input;
  const unit = t('analytics.energy.unit');
  const { top, densest } = picks;
  return [
    {
      id: 'connected',
      label: t('v2e.fig.connected'),
      value: `${oneDecimal(total.connected)} ${unit}`,
      sub: fill(t('v2e.fig.connectedSub'), { n: total.machines }),
    },
    {
      id: 'running',
      label: t('v2e.fig.running'),
      value: `${oneDecimal(total.running)} ${unit}`,
      sub: fill(t('v2e.fig.runningSub'), { pct }),
    },
    ...(top
      ? [
          {
            id: 'heaviest',
            label: t('v2e.fig.heaviest'),
            value: name(top),
            sub: `${oneDecimal(top.connectedKva)} ${unit} · ${machinesLine(top, t)}`,
          },
        ]
      : []),
    ...(densest
      ? [
          {
            id: 'densest',
            label: t('v2e.fig.densest'),
            value: name(densest),
            sub: `${oneDecimal(densest.avgConnectedKva)} ${unit} ${t('v2e.fig.perMachine')}`,
          },
        ]
      : []),
  ];
}

function gridsFor(content: EnergyContent, names: Names3, t: TFunction): EnergyGridModel[] {
  const pct = content.effFactorPct;
  const kva = (tile: EnergyTile) => tile.connectedKva;
  return [
    gridOf(
      'cell',
      content.byCell,
      {
        title: t('analytics.energy.cellTitle'),
        sub: t('analytics.energy.cellDescription', { pct }),
        axis: t('analytics.drill.cell'),
      },
      { t, names: { name: names.cell }, open: { axis: 'cell' }, value: kva },
    ),
    gridOf(
      'location',
      content.byLocation,
      {
        title: t('analytics.energy.locationTitle'),
        sub: t('analytics.energy.locationDescription'),
        axis: t('analytics.energy.axisLocation'),
      },
      { t, names: { name: names.place }, open: { axis: 'location' }, value: kva },
    ),
    gridOf(
      'machine',
      content.byMachine,
      {
        title: t('analytics.energy.machineTitle'),
        sub: t('analytics.energy.machineDescription'),
        axis: t('analytics.drill.cell'),
      },
      { t, names: { name: names.cell }, value: (tile) => tile.avgConnectedKva },
    ),
  ];
}

/**
 * The Energy screen from the engine's `a5-energy` figure: its two load maps (by cell, by location) and the per-machine
 * average map, every tile the engine's bucket with its own machines behind it. The plant's totals are sums of the cell
 * tiles (a machine sits in exactly one), the tint is each tile's weight against its own map. Null when the engine has
 * not computed it.
 */
export function energyModel(reply: FiguresPart, t: TFunction): EnergyModel | null {
  const figure = figureOf(reply, FIGURE);
  const content = figure?.status === 'ready' ? contentOf(figure, t) : null;
  if (content?.kind !== 'energy') return null;
  const names: Names3 = {
    cell: (tile) =>
      tile.key === '—' ? t('analytics.energy.noCell') : fill(t('v2m.reg.cell'), { n: tile.key }),
    place: (tile) => `${t('analytics.energy.axisLocation')} ${tile.key}`,
  };
  const cells = content.byCell.tiles;
  const picks: Picks = {
    top: heaviest(cells, (tile) => tile.connectedKva),
    densest: heaviest(cells, (tile) => tile.avgConnectedKva),
  };
  const [total, pct] = [totalsOf(cells), content.effFactorPct];
  const source = fill(t('v2e.source'), { date: shortDate(reply.asOf) });
  const say_: Translate = (key, values) => t(key, { ...values }) as string;
  return {
    verdict: verdictFor({ picks, total, pct, source }, names.cell, t),
    figures: figuresFor({ picks, total, pct }, names.cell, t),
    grids: gridsFor(content, names, t),
    drill: drillFor(reply, FIGURE, say_),
    source,
    words: { why: t('v2p.why'), heat: { low: t('v2e.heat.low'), high: t('v2e.heat.high') } },
  };
}
