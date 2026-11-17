import { describe, expect, it } from 'vitest';
import { formatDateTime } from './format.js';

describe('formatDateTime', () => {
  /** 30 minutes into the plant's 17 November, but still 16 November in UTC. */
  const afterPlantMidnight = '2026-11-16T19:00:00.000Z';

  it("renders a plant time on the plant's day, not the browser's", () => {
    expect(formatDateTime(afterPlantMidnight, 'Asia/Kolkata')).toContain('17 Nov');
    expect(formatDateTime(afterPlantMidnight, 'UTC')).toContain('16 Nov');
  });

  it('adds the year for a last sign-in, which may be older than this year', () => {
    expect(formatDateTime(afterPlantMidnight, 'Asia/Kolkata', true)).toContain('17 Nov 2026');
  });
});
