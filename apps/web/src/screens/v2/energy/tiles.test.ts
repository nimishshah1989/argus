// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { realReply } from '../figures/real-reply.js';
import { realT } from '../printed-page/test-support.js';
import { energyModel } from './adapter.js';

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
      if (figure.key !== 'a5-energy') return figure;
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
    expect(first.lines).toEqual(['Running: 12.0 KVA', '2 machines', 'avg 10.0']);
  });

  it('shows a cell with no machines as a dash with its words, and does not open it', () => {
    const empty = cell.tiles[1]!;
    expect(empty.name).toBe('No cell');
    expect(empty.value).toBe('—');
    expect(empty.lines).toEqual(['No machines']);
    expect(empty.drill).toBeUndefined();
    expect(cell.tiles[0]!.drill).toBeDefined();
  });

  it('opens nothing on the per-machine average map, which v1 never drilled', () => {
    expect(model.grids[2]!.tiles.every((tile) => tile.drill === undefined)).toBe(true);
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
