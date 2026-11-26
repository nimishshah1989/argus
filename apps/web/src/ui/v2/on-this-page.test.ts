import { describe, expect, it } from 'vitest';
import { fixedZone, sectionsIn, slug } from './on-this-page.js';

describe('On this page (ADR 0061)', () => {
  it('lists each title once with a unique anchor, and skips live messages', () => {
    // No DOM here: headings stand in with the four things `sectionsIn` reads.
    const h2 = (text: string, live = false) => ({
      textContent: text,
      dataset: {} as Record<string, string>,
      closest: () => (live ? {} : null),
    });
    const heads = [
      h2('Repeat offenders'),
      h2('Often, or long?'),
      h2('Saved', true),
      h2('Repeat offenders'),
      h2('Often, or long'),
      h2('  '),
    ];
    const root = { querySelectorAll: () => heads } as unknown as ParentNode;
    expect(sectionsIn(root)).toEqual([
      { id: 'repeat-offenders', title: 'Repeat offenders' },
      { id: 'often-or-long', title: 'Often, or long?' },
      { id: 'often-or-long-2', title: 'Often, or long' },
    ]);
    expect(heads[0]?.dataset.section).toBe('repeat-offenders');
  });

  it('keeps Gujarati letters in an anchor', () => {
    expect(slug('આ પાના પર')).toBe('આ-પાના-પર');
  });

  it('the floor, the desk and settings keep their order: no index there (two-zone rule)', () => {
    for (const path of ['/desk', '/desk/board', '/floor/report', '/settings/machines'])
      expect(fixedZone(path)).toBe(true);
    for (const path of ['/analytics/breakdowns', '/gallery', '/desktop'])
      expect(fixedZone(path)).toBe(false);
  });
});
