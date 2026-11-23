import { describe, expect, it } from 'vitest';
import type { ActionCenterBoardReply } from '@uptimo/shared';
import { bannerOf, dmy, plantDayOf } from './action-center.js';

/**
 * What the other Today screens still read of the Action Center. The screen's own mapping is tested beside it, in
 * `screens/v2/action-center/action-center.test.ts`, which carries every assertion this file held about the cards.
 */
const BOARD = {
  counts: { open: 33, ack: 1, snoozed: 1, resolved: 1 },
  bySeverity: { high: 6, med: 25, low: 2, info: 0 },
} as ActionCenterBoardReply;

describe('the Dashboard banner and the plant dates', () => {
  it('banners the open high and medium counts, and hides with nothing open', () => {
    expect(bannerOf(BOARD)).toEqual({ high: 6, medium: 25 });
    expect(bannerOf({ ...BOARD, counts: { open: 0, ack: 0, snoozed: 0, resolved: 0 } })).toBeNull();
  });

  it('prints a plant day as DD-MM-YYYY and reads an instant in the plant zone', () => {
    expect(dmy('2026-11-11')).toBe('11-11-2026');
    expect(dmy(null)).toBe('');
    expect(dmy('not a date')).toBe('');
    expect(plantDayOf('2026-11-18T20:00:00.000Z', 'Asia/Kolkata')).toBe('2026-11-19');
    expect(plantDayOf('2026-11-18T20:00:00.000Z', 'UTC')).toBe('2026-11-18');
  });
});
