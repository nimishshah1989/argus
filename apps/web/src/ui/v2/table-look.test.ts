import { describe, expect, it } from 'vitest';
import { tidyCell } from './table-look.js';

/** A duration column reads as time (DOMAIN.md §5): the Breakdown log printed "0.67" where a reader wants "40 min". */
describe('tidyCell in a duration column', () => {
  it('prints hours and minutes as time, as the desk does', () => {
    expect(tidyCell('0.67', 'hours')).toBe('40 min');
    expect(tidyCell('1.83', 'hours')).toBe('1 h 50 min');
    expect(tidyCell(2.43, 'hours')).toBe('2 h 26 min');
    expect(tidyCell('1,250', 'minutes')).toBe('20 h 50 min');
  });

  it('leaves a dash and words alone, and a column with no unit as before', () => {
    expect(tidyCell('—', 'hours')).toBe('—');
    expect(tidyCell('n/a', 'hours')).toBe('n/a');
    expect(tidyCell('0.67')).toBe('0.67');
  });
});
