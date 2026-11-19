import { DEFAULT_PROFILE } from '@uptimo/shared';
import { expect, it } from 'vitest';
import { COMPUTERS, runWith } from '../src/index.js';
import { MANY_YEARS } from './many-years/fixture.js';

/**
 * Ticket 76, packet 76o: a run that names no span keeps A10's old window. The last report is in 2026, so a run on
 * 5 January 2027 counts the fleet's available hours over all of 2026 (4 machines x 12 months x 500 h = 24,000), not
 * the five days of 2027. All 217 failures and 354 h of both years sit against that: MTBF (24,000 - 354) / 217 = 109.
 */
it('A10 with no span reads the data year, not the empty year after it', () => {
  const result = runWith(
    { 'a10-problems': COMPUTERS['a10-problems']! },
    { data: MANY_YEARS, asOf: '2027-01-05', profile: DEFAULT_PROFILE },
  );
  const text = JSON.stringify(result.figures.find((f) => f.key === 'a10-problems')?.value);
  expect(text).toContain('was 109 hrs');
});
