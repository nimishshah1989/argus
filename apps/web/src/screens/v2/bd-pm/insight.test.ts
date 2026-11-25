import { describe, expect, it } from 'vitest';
import { hasYardstick, tilesIn } from '../insight.js';
import { answerKey, testT } from '../printed-page/test-support.js';
import { bdPmModel } from './adapter.js';
import type { BdPmModel } from './model.js';

/**
 * Ticket 658 (ADR 0035): each of the five tables opens with a kit line over its cells (PLANT TOTAL left out), and every
 * figure tile names a yardstick. Critical tests only (ADR 0034): figures, not wording or tone. Answer key 11 Nov.
 */
const model = bdPmModel(answerKey('a1-bd-pm', 'a1-bd-pm', 40), testT) as BdPmModel;

/** Each section and the figures its line must carry. */
const SECTIONS: Record<string, string[]> = {
  cell: ['Cell 1', '2.3', '1.38%'],
  'bd-share': ['Cell 1', '2.7', '1.36%'],
  'pm-share': ['Cell 2', '3.5', '0.27%'],
  'bd-hours': ['3', '9', '61%'],
  'pm-hours': ['2', '9', '71%'],
};

/** Tile label → the figures its yardstick must carry. */
const YARDSTICKS: Record<string, string[]> = {
  'Actual Breakdown': ['80%', '3,819.4'],
  'PM Downtime': ['20%', '3,819.4'],
  'Avg Available Hrs / Machine': ['75%', '6,000'],
  'Total Available Hrs': ['75%', '7,50,000'],
  'Fleet Availability': ['99.31%'],
};

describe('BD % and PM split insight (ticket 658)', () => {
  it('gives every table a takeaway', () => {
    expect(Object.keys(model.takeaways ?? {}).sort()).toEqual(Object.keys(SECTIONS).sort());
    for (const id of Object.keys(SECTIONS))
      expect(model.takeaways?.[id]?.text.length, id).toBeGreaterThan(0);
  });

  it('names the cell that stands out, or how few cells hold the hours, without the plant total row', () => {
    for (const [id, figures] of Object.entries(SECTIONS))
      for (const figure of figures) expect(model.takeaways?.[id]?.text ?? '', id).toContain(figure);
    for (const id of Object.keys(SECTIONS))
      expect(model.takeaways?.[id]?.text ?? '', id).not.toContain('PLANT TOTAL');
  });

  it('gives every figure tile a yardstick with the figure it is measured against', () => {
    expect(tilesIn(model).filter((tile) => !hasYardstick(tile))).toEqual([]);
    for (const [label, figures] of Object.entries(YARDSTICKS)) {
      const tile = model.figures.find((figure) => figure.label === label);
      for (const figure of figures) expect(tile?.yardstick ?? '', label).toContain(figure);
    }
  });

  it('never invents a comparison for the machine count', () => {
    const tile = model.figures.find((figure) => figure.label === 'Total Machines');
    expect(tile?.yardstick ?? '').not.toMatch(/\d/);
  });
});
