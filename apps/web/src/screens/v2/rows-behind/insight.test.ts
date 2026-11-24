// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { hasYardstick, tilesIn } from '../insight.js';
import { frozenRows } from './frozen.js';
import type { RowsModel } from './model.js';

/**
 * ADR 0035 (ticket 668): when the rows behind a figure are tickets, the drawer opens with a takeaway over all of them,
 * by machine and downtime; machine and move rows have nothing to add up and no line. Critical tests only (ADR 0034):
 * the figures, measured on the frozen 11 Nov drill replies (PM hours: 64 tickets on 50 machines, 759.3 h).
 */
const rows = async (figure: string): Promise<RowsModel> => (await frozenRows(figure))!;

describe('Rows behind insight (ticket 668)', () => {
  it('opens the PM-hours tickets with a takeaway over all 64 rows, and has no tiles to measure', async () => {
    const model = await rows('dashboard.pm-hours');
    expect(model.rows).toHaveLength(64);
    expect(Object.keys(model.takeaways ?? {})).toEqual(['rows']);
    for (const figure of ['4', '50', '54%'])
      expect(model.takeaways?.rows?.text ?? '').toContain(figure);
    expect(tilesIn(model).filter((tile) => !hasYardstick(tile))).toEqual([]);
  });

  it('says nothing over machine or move rows, which have no hours to add up', async () => {
    for (const figure of ['dashboard.breakdown-free', 'cell-change-log']) {
      const model = await rows(figure);
      expect(model.rows.length, figure).toBeGreaterThan(0);
      expect(Object.keys(model.takeaways ?? {}), figure).toEqual([]);
    }
  });
});
