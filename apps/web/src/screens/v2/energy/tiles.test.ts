// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { realReply } from '../figures/real-reply.js';
import { realT } from '../printed-page/test-support.js';
import { energyModel, FIGURE } from './adapter.js';

type Bucket = {
  key: string;
  machines: number;
  totalKva: number;
  avgKva: number;
  avgRunningKva: number;
  runningKva: number;
  machineIds: string[];
};

/** The real engine reply with the cell tiles replaced by the two cases a plant has: a normal cell, and a cell with no machines. */
function withCells(byCell: Bucket[]) {
  const reply = realReply();
  return {
    ...reply,
    figures: reply.figures.map((figure): FiguresReply['figures'][number] => {
      if (figure.key !== FIGURE) return figure;
      const value = figure.value as { extra: Record<string, unknown> };
      return { ...figure, value: { ...value, extra: { ...value.extra, byCell } } };
    }),
  };
}

const bucket = (key: string, machines: number, connected: number, running: number): Bucket => ({
  key,
  machines,
  totalKva: connected,
  avgKva: machines === 0 ? 0 : connected / machines,
  avgRunningKva: 0,
  runningKva: running,
  machineIds: Array.from({ length: machines }, (_, at) => `${key}-${at}`),
});

describe('an energy map', () => {
  const model = energyModel(withCells([bucket('1', 2, 20, 12), bucket('—', 0, 0, 0)]), realT)!;
  const cell = model.grids[0]!;

  it('prints each tile with its connected load, running load, machine count and average', () => {
    const first = cell.tiles[0]!;
    expect(first.id).toBe('cell:1');
    expect(first.value).toBe('20.0');
    expect(first.unit).toBe('Connected KVA');
    // The running load is the second thing a tile says, then the count and the average.
    expect(first.running).toBe('Running: 12.0 KVA');
    expect(first.lines).toEqual(['2 machines', 'avg 10.0']);
  });

  it('shows a cell with no machines as a dash with its words, and does not open it', () => {
    const empty = cell.tiles[1]!;
    expect(empty.name).toBe('No cell');
    expect(empty.value).toBe('—');
    expect(empty.lines).toEqual(['No machines']);
    expect(empty.drill).toBeUndefined();
    expect(cell.tiles[0]!.drill).toBeDefined();
  });

  it('says KVA/machine on the per-machine map and opens the cell’s machines like the first map', () => {
    const third = model.grids[2]!;
    const [first, none] = third.tiles;
    expect(first!.id).toBe('machine:1');
    expect(first!.value).toBe('10.0');
    expect(first!.unit).toBe('KVA/machine');
    expect(first!.running).toBeUndefined();
    expect(first!.drill?.figure).toBe(cell.tiles[0]!.drill?.figure);
    expect(none!.drill).toBeUndefined();
  });

  it('puts the figures at the legend’s ends and the range of each step under it', () => {
    const wide = energyModel(
      withCells([bucket('1', 2, 36, 20), bucket('2', 1, 513, 400), bucket('3', 4, 100, 50)]),
      realT,
    )!;
    const { scale } = wide.grids[0]!;
    expect(scale?.low).toBe('Lighter load · 36.0 KVA');
    expect(scale?.high).toBe('Heavier load · 513.0 KVA');
    expect(scale?.steps).toHaveLength(5);
    expect(scale?.steps[0]).toBe('36.0 to 131.4 KVA');
    expect(scale?.steps[4]).toBe('417.6 to 513.0 KVA');
    expect(wide.grids[2]!.scale?.low).toContain('KVA/machine');
  });

  it('has no legend numbers when no cell holds a machine', () => {
    const empty = energyModel(withCells([bucket('1', 0, 0, 0)]), realT)!;
    expect(empty.grids[0]!.scale).toBeUndefined();
  });
});

describe('the numbers behind an energy chart', () => {
  it('prints a load as its tile does, not as a float sum, and leaves out a tile with no machines', () => {
    const sums = energyModel(
      withCells([bucket('2', 3, 36, 12.600000000000001), bucket('—', 0, 0, 0)]),
      realT,
    )!;
    const chart = sums.grids[0]!.chart!.spec;
    expect(chart.kind).toBe('bar');
    if (chart.kind !== 'bar') return;
    expect(chart.categories).toEqual(['Cell 2']);
    expect(chart.series.map((series) => series.values)).toEqual([[36], [12.6]]);
  });
});
