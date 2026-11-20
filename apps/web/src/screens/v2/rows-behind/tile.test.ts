// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { parseTile, tileAddress, tileMachines } from './tile.js';

const bucket = (key: string, machineIds: string[]) => ({
  key,
  machines: machineIds.length,
  totalKva: 10 * machineIds.length,
  avgKva: 10,
  runningKva: 2 * machineIds.length,
  avgRunningKva: 2,
  machineIds,
});

/**
 * The engine puts a machine whose cell is not in the Settings list in the dash tile, so that tile holds 5 machines
 * while only 2 of them have a blank cell. The drawer must list the 5 the tile counts.
 */
const figure = {
  key: 'a5-energy',
  screen: 'a5-energy',
  owner: 41,
  status: 'ready',
  value: {
    pages: [{ page: 'a5', title: 'Energy Heatmap', kpis: [], tables: [], charts: [] }],
    extra: {
      effFactorPct: 20,
      byCell: [bucket('1', ['a', 'b']), bucket('—', ['c', 'd', 'e', 'f', 'g'])],
      byLocation: [bucket('Shop A', []), bucket('Hall: East', ['a', 'c'])],
    },
  },
  drill: { type: 'machine', ids: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] },
} as unknown as FiguresReply['figures'][number];

describe('the machines in an energy tile’s drawer', () => {
  it('are exactly the machines the tile counts, for the no-cell tile too', () => {
    expect(tileMachines(figure, { figure: 'a5-energy', axis: 'cell', tile: '1' })).toEqual([
      'a',
      'b',
    ]);
    expect(tileMachines(figure, { figure: 'a5-energy', axis: 'cell', tile: '—' })).toHaveLength(5);
  });

  it('are none for a tile the engine gave no machines, for a tile that is not there, and for a figure not computed', () => {
    expect(tileMachines(figure, { figure: 'a5-energy', axis: 'location', tile: 'Shop A' })).toEqual(
      [],
    );
    expect(tileMachines(figure, { figure: 'a5-energy', axis: 'cell', tile: 'nope' })).toEqual([]);
    const pending = { ...figure, status: 'not_computed' } as typeof figure;
    expect(tileMachines(pending, { figure: 'a5-energy', axis: 'cell', tile: '1' })).toEqual([]);
  });

  it('is addressed by figure, axis and tile, and a tile name with a colon survives the round trip', () => {
    const ref = { figure: 'a5-energy', axis: 'location', tile: 'Hall: East' } as const;
    expect(parseTile(tileAddress(ref))).toEqual(ref);
    expect(tileMachines(figure, ref)).toEqual(['a', 'c']);
  });

  it('leaves a plain figure key alone: it is not a tile', () => {
    expect(parseTile('a8-age')).toBeNull();
    expect(parseTile('a5-energy:other:3')).toBeNull();
  });
});
