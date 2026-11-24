// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { realReply } from '../figures/real-reply.js';
import { realT } from '../printed-page/test-support.js';
import { shiftKpisModel } from './adapter.js';

/** ADR 0031 §4: a takeaway per section and the engine's basis line as each tile's yardstick, no new words. */
const model = shiftKpisModel(realReply(), realT)!;

describe('Shift-calendar KPIs insight pass (ticket 642)', () => {
  it('prints the comparison headline once: the verdict carries it, the compare section has no takeaway (ADR 0033)', () => {
    expect(model.verdict.headline.map((seg) => seg.text).join('')).toBe(
      'On working hours a machine runs 462.0 hrs between breakdowns (439.9 on the platform basis); a breakdown takes 2.39 hrs to fix and availability is 99.36%.',
    );
    expect(model.takeaways['shift-kpis.compare'] ?? null).toBeNull();
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

  it('puts no takeaway over a backlog the engine has not computed: its empty state says so, once (ADR 0033)', () => {
    expect(model.sections.find((s) => s.id === 'shift-kpis.backlog')?.notComputed).toBe(true);
    expect(model.takeaways['shift-kpis.backlog'] ?? null).toBeNull();
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

  it('leaves the half-the-hours line to the map section: the verdict has no Why line a takeaway already says (ADR 0033)', () => {
    expect(model.verdict.why).toEqual([]);
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
