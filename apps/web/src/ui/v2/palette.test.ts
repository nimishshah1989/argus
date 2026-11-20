import { describe, expect, it } from 'vitest';
import { filterEntries, type PaletteEntry } from './palette-match.js';

const entry = (to: string, text: string, parent = ''): PaletteEntry => ({
  to,
  text,
  hint: parent ? `Screen in ${parent}` : 'Section',
  match: `${text} ${parent}`,
});
const entries = [
  entry('/analytics/breakdowns', 'Problems'),
  entry('/analytics/breakdowns?screen=a3-mttr-mtbf', 'MTTR and MTBF', 'Problems'),
  entry('/analytics/breakdowns?screen=fix-finder', 'Fix Finder', 'Problems'),
  entry('/analytics/reports', 'Reports'),
];
const to = (rows: PaletteEntry[]) => rows.map((row) => row.to);

describe('what the search keeps for what was typed', () => {
  it('lists everything, in order, for a blank query', () => {
    expect(to(filterEntries(entries, ''))).toEqual(to(entries));
    expect(to(filterEntries(entries, '   '))).toEqual(to(entries));
  });

  it('finds a screen by part of its name, whatever the case', () => {
    expect(to(filterEntries(entries, 'mttr'))).toEqual([
      '/analytics/breakdowns?screen=a3-mttr-mtbf',
    ]);
    expect(to(filterEntries(entries, '  FIX fin '))).toEqual([
      '/analytics/breakdowns?screen=fix-finder',
    ]);
  });

  it('also finds a screen by the section it sits in', () => {
    expect(to(filterEntries(entries, 'problems'))).toEqual([
      '/analytics/breakdowns',
      '/analytics/breakdowns?screen=a3-mttr-mtbf',
      '/analytics/breakdowns?screen=fix-finder',
    ]);
  });

  it('keeps nothing when nothing matches, and reads non-Latin names too', () => {
    expect(filterEntries(entries, 'zzz')).toEqual([]);
    const gujarati = [entry('/analytics/reports', 'અહેવાલો')];
    expect(to(filterEntries(gujarati, 'અહેવાલ'))).toEqual(['/analytics/reports']);
  });
});
