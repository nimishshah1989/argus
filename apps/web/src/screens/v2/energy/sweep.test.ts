// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { realReply } from '../figures/real-reply.js';
import { realT } from '../printed-page/test-support.js';
import { energyModel, FIGURE } from './adapter.js';
import { kvaText } from './sweep.js';

/** Sweep 706, batch D: Energy's KVA keeps its text under a lakh and reads as the kit's from a lakh up. */

describe('kvaText', () => {
  it('keeps the page’s one-decimal text under a lakh', () => {
    expect(kvaText(20)).toBe('20.0');
    expect(kvaText(1234.56)).toBe('1,234.6');
  });

  it('reads lakh-scale loads the kit’s way', () => {
    expect(kvaText(250000)).toBe('2.50 lakh');
    expect(kvaText(15000000)).toBe('1.50 cr');
  });
});

/** The real engine reply with one lakh-scale cell, so the tile prints through `kvaText`. */
function withBigCell() {
  const reply = realReply();
  const byCell = [
    {
      key: '1',
      machines: 2,
      totalKva: 250000,
      avgKva: 125000,
      avgRunningKva: 0,
      runningKva: 120000,
      machineIds: ['1-0', '1-1'],
    },
  ];
  return {
    ...reply,
    figures: reply.figures.map((figure): FiguresReply['figures'][number] => {
      if (figure.key !== FIGURE) return figure;
      const value = figure.value as { extra: Record<string, unknown> };
      return { ...figure, value: { ...value, extra: { ...value.extra, byCell } } };
    }),
  };
}

describe('an energy map with a lakh-scale cell', () => {
  it('prints the tile, its running load and its average the kit’s way', () => {
    const tile = energyModel(withBigCell(), realT)!.grids[0]!.tiles[0]!;
    expect(tile.value).toBe('2.50 lakh');
    expect(tile.running).toBe('Running: 1.20 lakh KVA');
    expect(tile.lines).toEqual(['2 machines', 'avg 1.25 lakh']);
  });
});
