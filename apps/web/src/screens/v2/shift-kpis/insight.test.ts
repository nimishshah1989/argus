// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { realReply } from '../figures/real-reply.js';
import { realT } from '../printed-page/test-support.js';
import { shiftKpisModel } from './adapter.js';

/** ADR 0031 §4: a takeaway per section and the engine's basis line as each tile's yardstick, no new words. */
const model = shiftKpisModel(realReply(), realT)!;

describe('Shift-calendar KPIs insight pass (#642)', () => {
  it('opens the platform comparison with the headline, neutral', () => {
    expect(model).toMatchObject({
      takeaways: {
        'shift-kpis.compare': {
          text: 'On working hours a machine runs 462.0 hrs between breakdowns (439.9 on the platform basis); a breakdown takes 2.39 hrs to fix and availability is 99.36%.',
          tone: 'neutral',
        },
      },
    });
  });

  it('names the shift with the most breakdown hours, leaving out the plant total row', () => {
    expect(model).toMatchObject({
      takeaways: {
        'shift-kpis.shift-split': {
          text: '1 (08:00–18:29) is 3.9× the average of the others (2,021.10).',
          tone: 'loss',
          outlier: '1 (08:00–18:29)',
        },
      },
    });
  });

  it('says the backlog is not computed when the engine has not computed it', () => {
    expect(model).toMatchObject({
      takeaways: { 'shift-kpis.backlog': { text: 'Not computed yet', tone: 'neutral' } },
    });
  });

  it('opens the breakdown map with the half-the-hours line, as a risk', () => {
    expect(model).toMatchObject({
      takeaways: {
        'shift-kpis.breakdown-map': {
          text: 'Half of the breakdown hours come from 13 of 125 machines, in 3 of 9 cells.',
          tone: 'risk',
        },
      },
    });
  });

  it('gives every tile its engine basis line as the yardstick', () => {
    const tiles = model.sections.flatMap((s) => s.figures);
    expect(tiles.length).toBeGreaterThan(0);
    for (const tile of tiles) {
      expect(tile.sub.length, tile.label).toBeGreaterThan(0);
      expect(tile, tile.label).toMatchObject({ yardstick: tile.sub });
    }
  });
});
