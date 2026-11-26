import type { TFunction } from 'i18next';
import type { ChartSpec } from '../../../ui/chart/use-chart.js';
import { fill } from '../../../i18n/fill.js';
import { levelOf, type HeatLevel } from '../../../ui/v2/domain/heat-matrix.js';
import type { HeatScale, HeatTileData } from '../../../ui/v2/domain/heat-tiles.js';
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
import { kvaText } from './sweep.js';
import {
  averageYardstick,
  heaviest,
  shareYardstick,
  takeawaysOf,
  totalsOf,
  type Names3,
  type Picks,
  type Totals,
} from './takeaways.js';

/** The engine's figure this screen is built from. */
export const FIGURE = 'a5-energy';
/** The value as its tile prints it, so the chart's numbers never carry a float sum's tail. */
const rounded = (n: number): number => Number(n.toFixed(1));

type Names = { name: (tile: EnergyTile) => string };

/** The lightest and heaviest figure among the tiles that hold machines; none when no tile does. */
function rangeOf(tiles: EnergyTile[], by: (tile: EnergyTile) => number): [number, number] | null {
  const filled = tiles.filter((tile) => tile.machines > 0).map(by);
  return filled.length === 0 ? null : [Math.min(...filled), Math.max(...filled)];
}

/** The tint of each tile against the grid's own range; a tile with no machines is not tinted. */
function levels(
  tiles: EnergyTile[],
  by: (tile: EnergyTile) => number,
  range: [number, number] | null,
): (HeatLevel | null)[] {
  return tiles.map((tile) =>
    tile.machines > 0 && range ? levelOf(by(tile), range[0], range[1]) : null,
  );
}

/**
 * The legend's numbers: the figure of the lightest and of the heaviest tile at its ends, and the range each of the five
 * steps covers (the same cuts `levelOf` makes), in the unit the tiles print.
 */
function scaleOf(
  range: [number, number] | null,
  unit: string,
  t: TFunction,
): HeatScale | undefined {
  if (!range) return undefined;
  const [min, max] = range;
  const at = (step: number) => min + ((max - min) * step) / 5;
  const end = (word: string, value: number) =>
    fill(t('v2e.heat.end'), { word, value: `${kvaText(value)} ${unit}` });
  return {
    low: end(t('v2e.heat.low'), min),
    high: end(t('v2e.heat.high'), max),
    steps: [0, 1, 2, 3, 4].map((step) =>
      fill(t('v2e.heat.range'), {
        from: kvaText(at(step)),
        to: kvaText(at(step + 1)),
        unit,
      }),
    ),
  };
}

function loadChart(
  grid: EnergyGrid,
  text: { title: string; axis: string },
  names: Names,
  t: TFunction,
) {
  const { axis } = text;
  /** The map's own title heads its section, so the chart under it has a title of its own. */
  const title = fill(t('v2e.chart'), { axis: axis.toLocaleLowerCase() });
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
  /** The map the tile is on; it names the tile and says which of the engine's axes its machines are read by. */
  grid: EnergyGridModel['id'];
  /** The machines of a tile open in the drawer, read by this axis. */
  open: { axis: EnergyGrid['axis'] };
  /** What the tile's figure is: the connected load, or the average per machine. */
  value: (tile: EnergyTile) => number;
  /** What that figure is measured in: connected KVA, or KVA a machine. */
  unit: string;
  showRunning: boolean;
};

function tileOf(tile: EnergyTile, level: HeatLevel | null, ctx: TileCtx): HeatTileData {
  const { t, names } = ctx;
  const name = names.name(tile);
  const { unit } = ctx;
  const empty = tile.machines === 0;
  const running = `${t('analytics.energy.running')}: ${kvaText(tile.runningKva)} ${t('analytics.energy.unit')}`;
  /** The map of averages says the average as its figure, so its lines hold only the count. */
  const counted = ctx.showRunning
    ? [machinesLine(tile, t), t('analytics.energy.avg', { value: kvaText(tile.avgConnectedKva) })]
    : [machinesLine(tile, t)];
  const lines = empty ? [t('analytics.energy.noMachines')] : counted;
  const value = empty ? '—' : kvaText(ctx.value(tile));
  const drill: Drill | undefined =
    tile.machineIds.length > 0
      ? {
          figure: tileAddress({ figure: FIGURE, axis: ctx.open.axis, tile: tile.key }),
          label: fill(t('v2e.tile.open'), { name }),
        }
      : undefined;
  return {
    id: `${ctx.grid}:${tile.key}`,
    name,
    value,
    unit: empty ? '' : unit,
    ...(ctx.showRunning && !empty ? { running } : {}),
    lines,
    level,
    summary: empty
      ? `${name}. ${lines.join('. ')}`
      : `${name}: ${value} ${unit}. ${ctx.showRunning ? `${running}. ` : ''}${lines.join('. ')}`,
    ...(drill ? { drill } : {}),
  };
}

function gridOf(
  id: EnergyGridModel['id'],
  grid: EnergyGrid,
  text: { title: string; sub: string; axis: string; scaleUnit: string },
  ctx: Omit<TileCtx, 'showRunning' | 'grid' | 'open'>,
): EnergyGridModel {
  const { tiles } = grid;
  const range = rangeOf(tiles, ctx.value);
  const shade = levels(tiles, ctx.value, range);
  return {
    id,
    title: text.title,
    sub: text.sub,
    chart: grid.showRunning ? loadChart(grid, text, ctx.names, ctx.t) : null,
    scale: scaleOf(range, text.scaleUnit, ctx.t),
    tiles: tiles.map((tile, at) =>
      tileOf(tile, shade[at] ?? null, {
        ...ctx,
        grid: id,
        open: { axis: grid.axis },
        showRunning: grid.showRunning,
      }),
    ),
  };
}

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
          kva: strong(`${kvaText(top.connectedKva)} ${unit}`),
          total: `${kvaText(total.connected)} ${unit}`,
          machines: String(total.machines),
        })
      : [{ text: t('v2e.noFigures') }],
    [
      say(t('v2e.running'), { pct: String(pct) }),
      densest
        ? say(t('v2e.densest'), {
            cell: name(densest),
            avg: `${kvaText(densest.avgConnectedKva)} ${unit}`,
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
      value: `${kvaText(total.connected)} ${unit}`,
      sub: fill(t('v2e.fig.connectedSub'), { n: total.machines }),
      yardstick: averageYardstick(total, t),
    },
    {
      id: 'running',
      label: t('v2e.fig.running'),
      value: `${kvaText(total.running)} ${unit}`,
      sub: fill(t('v2e.fig.runningSub'), { pct }),
      yardstick: shareYardstick(total.running, total, t),
    },
    ...(top
      ? [
          {
            id: 'heaviest',
            label: t('v2e.fig.heaviest'),
            value: name(top),
            sub: `${kvaText(top.connectedKva)} ${unit} · ${machinesLine(top, t)}`,
            yardstick: shareYardstick(top.connectedKva, total, t),
          },
        ]
      : []),
    ...(densest
      ? [
          {
            id: 'densest',
            label: t('v2e.fig.densest'),
            value: name(densest),
            sub: `${kvaText(densest.avgConnectedKva)} ${unit} ${t('v2e.fig.perMachine')}`,
            yardstick: averageYardstick(total, t),
          },
        ]
      : []),
  ];
}

function gridsFor(content: EnergyContent, names: Names3, t: TFunction): EnergyGridModel[] {
  const pct = content.effFactorPct;
  const kva = (tile: EnergyTile) => tile.connectedKva;
  const kvaUnit = t('analytics.energy.unit');
  const connected = `${t('analytics.energy.connected')} ${kvaUnit}`;
  return [
    gridOf(
      'cell',
      content.byCell,
      {
        title: t('analytics.energy.cellTitle'),
        sub: t('analytics.energy.cellDescription', { pct }),
        axis: t('analytics.drill.cell'),
        scaleUnit: kvaUnit,
      },
      { t, names: { name: names.cell }, value: kva, unit: connected },
    ),
    gridOf(
      'location',
      content.byLocation,
      {
        title: t('analytics.energy.locationTitle'),
        sub: t('analytics.energy.locationDescription'),
        axis: t('analytics.energy.axisLocation'),
        scaleUnit: kvaUnit,
      },
      { t, names: { name: names.place }, value: kva, unit: connected },
    ),
    gridOf(
      'machine',
      content.byMachine,
      {
        title: t('analytics.energy.machineTitle'),
        sub: t('analytics.energy.machineDescription'),
        axis: t('analytics.drill.cell'),
        scaleUnit: t('v2e.unit.perMachine'),
      },
      {
        t,
        names: { name: names.cell },
        value: (tile) => tile.avgConnectedKva,
        unit: t('v2e.unit.perMachine'),
      },
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
    takeaways: takeawaysOf(content, names, say_),
    figures: figuresFor({ picks, total, pct }, names.cell, t),
    grids: gridsFor(content, names, t),
    drill: drillFor(reply, FIGURE, say_),
    source,
    words: {
      why: t('v2p.why'),
      heat: { low: t('v2e.heat.low'), high: t('v2e.heat.high') },
      chartView: t('v2e.chartView'),
    },
  };
}
