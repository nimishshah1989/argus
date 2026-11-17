import { describe, expect, it } from 'vitest';
import { plantToday } from './TasksList.js';

describe('plantToday (ticket 19)', () => {
  it('rolls the day where the plant is, not where the server is', () => {
    // 19:00 UTC is already 00:30 the next day in Kolkata, while Los Angeles is still 1 January.
    // A formatter with no zone can match only one of them, whatever zone the test machine runs in.
    const now = new Date('2026-01-01T19:00:00Z');
    expect(plantToday('Asia/Kolkata', now)).toBe('2026-01-02');
    expect(plantToday('America/Los_Angeles', now)).toBe('2026-01-01');
  });
});
