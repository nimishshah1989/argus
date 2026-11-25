import { describe, expect, it } from 'vitest';
import { dayValue } from '../printed-page/printed.js';

describe('the platform day sorts as a date', () => {
  it('orders DD-MM-YYYY chronologically across months and years, not as text', () => {
    const days = ['05-01-2027', '28-12-2026', '03-08-2026', '31-12-2025', '04-08-2026'];
    const sorted = [...days].sort((a, b) => dayValue(a) - dayValue(b));
    expect(sorted).toEqual(['31-12-2025', '03-08-2026', '04-08-2026', '28-12-2026', '05-01-2027']);
  });
});

// The export-file test moved to sweep.test.ts (sweep 706: Excel replaces the CSV).
