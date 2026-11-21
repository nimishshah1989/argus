import { describe, expect, it } from 'vitest';
import { gridRange } from './calendar-events.js';

describe('the calendar grid’s range', () => {
  it('turns the library’s exclusive grid end into the inclusive plant day the API asks for', () => {
    expect(gridRange('2026-10-26', '2026-12-07')).toEqual({ from: '2026-10-26', to: '2026-12-06' });
  });

  it('keeps only the day of a start or end that carries a time, and crosses a year end', () => {
    expect(gridRange('2026-12-28T00:00:00', '2027-02-08T00:00:00')).toEqual({
      from: '2026-12-28',
      to: '2027-02-07',
    });
  });
});
