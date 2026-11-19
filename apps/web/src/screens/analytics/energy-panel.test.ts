import { describe, expect, it } from 'vitest';
import '../../i18n/index.js';
import { panelIds } from './EnergyPage.js';
import type { EnergyContent, EnergyTile } from './figure-content.js';

const tile = (key: string, machineIds: string[]): EnergyTile => ({
  key,
  machines: machineIds.length,
  connectedKva: 10 * machineIds.length,
  avgConnectedKva: 10,
  runningKva: 2 * machineIds.length,
  avgRunningKva: 2,
  machineIds,
});

/**
 * The engine puts a machine whose cell is not in the Settings list in the dash tile, so that tile holds 5 machines
 * while only 2 of them have a blank cell. The panel must list the 5 the tile counts.
 */
const content: EnergyContent = {
  kind: 'energy',
  title: 'Energy Heatmap',
  effFactorPct: 20,
  byCell: {
    axis: 'cell',
    showRunning: true,
    tiles: [tile('1', ['a', 'b']), tile('—', ['c', 'd', 'e', 'f', 'g'])],
  },
  byLocation: { axis: 'location', showRunning: true, tiles: [tile('Shop A', [])] },
  byMachine: { axis: 'cell', showRunning: false, tiles: [] },
};

describe('the machines in an energy tile panel', () => {
  it('are exactly the machines the tile counts, for the no-cell tile too', () => {
    for (const key of ['1', '—']) {
      const found = content.byCell.tiles.find((candidate) => candidate.key === key)!;
      expect(panelIds(content, { axis: 'cell', key })).toEqual(found.machineIds);
      expect(panelIds(content, { axis: 'cell', key })).toHaveLength(found.machines);
    }
  });

  it('are none for a tile the engine gave no machines, and for a tile that is not there', () => {
    expect(panelIds(content, { axis: 'location', key: 'Shop A' })).toEqual([]);
    expect(panelIds(content, { axis: 'cell', key: 'nope' })).toEqual([]);
  });
});
