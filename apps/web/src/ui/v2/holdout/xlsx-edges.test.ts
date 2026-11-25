import { describe, expect, it } from 'vitest';
import { sheetNames, workbookBytes } from '@uptimo/shared/xlsx';

describe('xlsx hardening, hidden (ADR 0041, was ticket 732)', () => {
  it('a third clash takes (3); a name already taken as "(2)" pushes the clash on', () => {
    expect(sheetNames(['A', 'a', 'A'])).toEqual(['A', 'a (2)', 'A (3)']);
    expect(sheetNames(['A (2)', 'A', 'a'])).toEqual(['A (2)', 'A', 'a (3)']);
  });

  it('a name of only banned characters becomes dashes, not Sheet<N>', () => {
    expect(sheetNames(['/?'])).toEqual(['--']);
  });

  it('spaces left at the cut are trimmed', () => {
    expect(sheetNames([`${'Y'.repeat(30)} Z`])).toEqual(['Y'.repeat(30)]);
  });

  it('every name stays within 31 characters and unique ignoring case', () => {
    const names = sheetNames(Array.from({ length: 12 }, () => 'Q'.repeat(31)));
    expect(names.every((n) => n.length <= 31)).toBe(true);
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(12);
    expect(names[10]).toBe(`${'Q'.repeat(26)} (11)`);
  });

  it('a workbook with no sheets and no docRef is still a valid one-sheet workbook', () => {
    const text = new TextDecoder().decode(workbookBytes([]));
    expect(text).toContain('xl/worksheets/sheet1.xml');
    expect(text).toContain('<sheetData/>');
  });
});
