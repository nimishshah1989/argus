/** Ticket 635 hidden edges: odd shapes never throw, one lg- ticket is enough, the year must be four digits. */
import { describe, expect, it } from 'vitest';
import { isLegacyYearFile } from '../../src/seed/import-cli.js';

describe('isLegacyYearFile edges', () => {
  it.each([
    undefined,
    42,
    'lg-2023-bd-x-1',
    [],
    { tickets: 'lg-2023-' },
    { tickets: [null, 7, 'lg-2023-x'] },
    { tickets: [{ legacyId: 2023 }] },
    { tickets: [{}] },
  ])('is false and does not throw for %j', (input) => {
    expect(isLegacyYearFile(input)).toBe(false);
  });

  it('is true when one ticket among many is a legacy row', () => {
    const tickets = [{ legacyId: 'bd-1' }, {}, { legacyId: 'lg-2025-bd-VTL-1-9' }];
    expect(isLegacyYearFile({ tickets })).toBe(true);
  });

  it('needs a four-digit year straight after lg-', () => {
    expect(isLegacyYearFile({ tickets: [{ legacyId: 'lg-23-bd-x-1' }] })).toBe(false);
    expect(isLegacyYearFile({ tickets: [{ legacyId: 'LG-0e147980' }] })).toBe(false);
    expect(isLegacyYearFile({ tickets: [{ legacyId: 'xlg-2023-bd-x-1' }] })).toBe(false);
  });
});
