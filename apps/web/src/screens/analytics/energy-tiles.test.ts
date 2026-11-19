import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../../i18n/index.js';
import { EnergyGridView } from './energy-tiles.js';
import type { EnergyGrid, EnergyTile } from './figure-content.js';

const tile = (key: string, machines: number, connected: number, running: number): EnergyTile => ({
  key,
  machines,
  connectedKva: connected,
  avgConnectedKva: machines === 0 ? 0 : connected / machines,
  runningKva: running,
  avgRunningKva: 0,
  machineIds: [],
});

const grid: EnergyGrid = {
  axis: 'cell',
  showRunning: true,
  tiles: [tile('1', 2, 20, 12), tile('—', 0, 0, 0)],
};

const draw = (onPick?: (key: string) => void) =>
  renderToStaticMarkup(
    h(EnergyGridView, {
      grid,
      id: 'cell',
      title: 'Load by Cell',
      axisLabel: 'Cell',
      description: 'About the grid',
      ...(onPick === undefined ? {} : { onPick }),
    }),
  );

describe('an energy grid', () => {
  it('prints each tile with its connected load, running load, machine count and average', () => {
    const page = draw(() => {});
    expect(page).toContain('data-tile="cell:1"');
    expect(page).toContain('20.0');
    expect(page).toContain('Connected KVA');
    expect(page).toContain('Running: 12.0 KVA · 2 machines · avg 10.0');
  });

  it('shows a cell with no machines as a dash with its words, and does not open it', () => {
    const page = draw(() => {});
    expect(page).toContain('No cell');
    expect(page).toContain('No machines');
    expect(page.match(/<button/g)).toHaveLength(1);
  });

  it('opens nothing on the average grid, which has no pick', () => {
    expect(draw()).not.toContain('<button');
  });
});

describe('the numbers behind an energy chart', () => {
  it('prints a load as its tile does, not as a float sum, and leaves out a tile with no machines', () => {
    const sums: EnergyGrid = {
      axis: 'cell',
      showRunning: true,
      tiles: [tile('2', 3, 36, 12.600000000000001), tile('—', 0, 0, 0)],
    };
    const page = renderToStaticMarkup(
      h(EnergyGridView, {
        grid: sums,
        id: 'cell',
        title: 'T',
        axisLabel: 'Cell',
        description: 'D',
      }),
    );
    const numbers = page.slice(page.indexOf('<details'), page.indexOf('</details>'));
    expect(numbers).toContain('>12.6<');
    expect(numbers).not.toContain('12.600000000000001');
    expect(numbers).not.toContain('No cell');
  });
});
