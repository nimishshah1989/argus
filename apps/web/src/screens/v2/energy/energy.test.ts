// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { contentOf } from '../../analytics/figure-content.js';
import { printed, realReply, UUID } from '../figures/real-reply.js';
import { realT } from '../printed-page/test-support.js';
import { parseTile, tileMachines } from '../rows-behind/tile.js';
import { energyModel, FIGURE } from './adapter.js';

const reply = realReply();
const figure = reply.figures.find((f) => f.key === FIGURE)!;
const engine = contentOf(figure, realT);
if (engine?.kind !== 'energy') throw new Error('the engine did not compute the energy figure');
const model = energyModel(reply, realT)!;
const kva = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

describe('Energy from the engine reply', () => {
  it('draws the three maps, one tile for every bucket the engine sent, in its order', () => {
    expect(model.grids.map((grid) => grid.id)).toEqual(['cell', 'location', 'machine']);
    expect(model.grids[0]!.tiles).toHaveLength(engine.byCell.tiles.length);
    expect(model.grids[1]!.tiles).toHaveLength(engine.byLocation.tiles.length);
    expect(model.grids[2]!.tiles).toHaveLength(engine.byCell.tiles.length);
  });

  it('prints every bucket’s figures: connected load, running load, machine count and average', () => {
    const shown = printed(model).join('\n');
    for (const tile of [...engine.byCell.tiles, ...engine.byLocation.tiles]) {
      expect(shown, `${tile.key} connected`).toContain(kva(tile.connectedKva));
      expect(shown, `${tile.key} running`).toContain(kva(tile.runningKva));
      expect(shown, `${tile.key} average`).toContain(`avg ${kva(tile.avgConnectedKva)}`);
    }
    for (const tile of engine.byCell.tiles)
      expect(shown, 'per-machine average').toContain(kva(tile.avgConnectedKva));
  });

  it('opens, from each tile, exactly the machines that tile counts (its number equals its rows)', () => {
    const grids = [
      [model.grids[0]!, engine.byCell],
      [model.grids[1]!, engine.byLocation],
    ] as const;
    for (const [grid, source] of grids) {
      grid.tiles.forEach((tile, at) => {
        const counted = source.tiles[at]!;
        if (counted.machines === 0) return expect(tile.drill).toBeUndefined();
        const ref = parseTile(tile.drill!.figure)!;
        expect(ref.axis).toBe(source.axis);
        expect(tileMachines(figure, ref)).toHaveLength(counted.machines);
        expect(tile.summary).toContain(`${counted.machines} machine`);
      });
    }
  });

  it('opens, from a tile of the per-machine map, the same machines as the cell map’s tile', () => {
    model.grids[2]!.tiles.forEach((tile, at) => {
      expect(tile.drill?.figure).toBe(model.grids[0]!.tiles[at]!.drill?.figure);
      expect(tile.unit === '' || tile.unit === 'KVA/machine').toBe(true);
    });
  });

  it('keeps every chart out of the way: the tiles lead and a map’s chart is there to be asked for', () => {
    expect(model.grids.filter((grid) => grid.chart !== null).map((grid) => grid.id)).toEqual([
      'cell',
      'location',
    ]);
    expect(model.words.chartView).toBe('Chart view');
  });

  it('numbers the legend from the tiles the map prints', () => {
    const tiles = engine.byCell.tiles.filter((tile) => tile.machines > 0);
    const [min, max] = [
      Math.min(...tiles.map((tile) => tile.connectedKva)),
      Math.max(...tiles.map((tile) => tile.connectedKva)),
    ];
    expect(model.grids[0]!.scale?.low).toContain(kva(min));
    expect(model.grids[0]!.scale?.high).toContain(kva(max));
  });

  it('counts every machine once across the cell tiles, so the plant total is the figure’s own rows', () => {
    const counted = engine.byCell.tiles.reduce((sum, tile) => sum + tile.machines, 0);
    expect(counted).toBe(figure.drill.ids.length);
    expect(model.figures[0]!.sub).toContain(`${counted} machines`);
    expect(model.drill?.figure).toBe(FIGURE);
  });

  it('tints a tile by its weight against its own map, and never a tile with no machines', () => {
    const levels = model.grids[0]!.tiles.map((tile) => tile.level);
    expect(Math.max(...levels.filter((l): l is NonNullable<typeof l> => l !== null))).toBe(5);
    expect(Math.min(...levels.filter((l): l is NonNullable<typeof l> => l !== null))).toBe(1);
    expect(
      model.grids[1]!.tiles.filter((t) => t.value === '—').every((t) => t.level === null),
    ).toBe(true);
  });

  it('names the heaviest cell in the answer and gives each load map its chart of connected beside running', () => {
    const top = [...engine.byCell.tiles].sort((a, b) => b.connectedKva - a.connectedKva)[0]!;
    expect(model.verdict.headline.map((seg) => seg.text).join('')).toContain(kva(top.connectedKva));
    expect(model.grids[0]!.chart?.spec.kind).toBe('bar');
    expect(model.grids[2]!.chart).toBeNull();
  });

  it('never prints a database id', () => {
    expect(printed(model).some((text) => UUID.test(text))).toBe(false);
  });

  it('says nothing was computed rather than drawing nothing', () => {
    const none = {
      ...reply,
      figures: reply.figures.map((f) =>
        f.key === FIGURE ? { ...f, status: 'not_computed' as const, value: null } : f,
      ),
    };
    expect(energyModel(none, realT)).toBeNull();
  });
});
