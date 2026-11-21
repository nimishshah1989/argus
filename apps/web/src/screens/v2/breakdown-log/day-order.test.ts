import { describe, expect, it } from 'vitest';
import { dayValue } from '../printed-page/printed.js';
import { logCsv } from './csv.js';

describe('the platform day sorts as a date', () => {
  it('orders DD-MM-YYYY chronologically across months and years, not as text', () => {
    const days = ['05-01-2027', '28-12-2026', '03-08-2026', '31-12-2025', '04-08-2026'];
    const sorted = [...days].sort((a, b) => dayValue(a) - dayValue(b));
    expect(sorted).toEqual(['31-12-2025', '03-08-2026', '04-08-2026', '28-12-2026', '05-01-2027']);
  });
});

describe('the export file', () => {
  it('leaves the eye column out and keeps every other cell as the engine printed it', () => {
    const csv = logCsv(
      ['', 'Sr No', 'Problem'],
      [
        ['\u{1F441}', '2', 'Belt, slipping'],
        ['\u{1F441}', '1', '—'],
      ],
    );
    expect(csv.split('\n')).toEqual(['Sr No,Problem', '2,"Belt, slipping"', '1,—']);
  });
});
